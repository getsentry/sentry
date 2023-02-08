from __future__ import annotations

from collections import namedtuple
from datetime import datetime
from typing import Any, Dict, Generator, List, Optional, Union

from snuba_sdk import (
    Column,
    Condition,
    Entity,
    Function,
    Granularity,
    Identifier,
    Lambda,
    Limit,
    Offset,
    Op,
    Query,
    Request,
)
from snuba_sdk.expressions import Expression
from snuba_sdk.orderby import Direction, OrderBy

from sentry.api.event_search import ParenExpression, SearchConfig, SearchFilter
from sentry.replays.lib.query import (
    ListField,
    Number,
    QueryConfig,
    String,
    Tag,
    all_values_for_tag_key,
    generate_valid_conditions,
    get_valid_sort_commands,
)
from sentry.utils.snuba import raw_snql_query

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 10
DEFAULT_OFFSET = 0

Paginators = namedtuple("Paginators", ("limit", "offset"))


def query_replays_collection(
    project_ids: List[int],
    start: datetime,
    end: datetime,
    environment: List[str],
    fields: List[str],
    sort: Optional[str],
    limit: Optional[str],
    offset: Optional[str],
    search_filters: List[SearchFilter],
) -> dict:
    """Query aggregated replay collection."""
    conditions = []
    if environment:
        conditions.append(Condition(Column("agg_environment"), Op.IN, environment))

    sort_ordering = get_valid_sort_commands(
        sort,
        default=OrderBy(Column("started_at"), Direction.DESC),
        query_config=ReplayQueryConfig(),
    )
    paginators = make_pagination_values(limit, offset)

    response = query_replays_dataset(
        project_ids=project_ids,
        start=start,
        end=end,
        where=[],
        having=conditions,
        fields=fields,
        sorting=sort_ordering,
        pagination=paginators,
        search_filters=search_filters,
    )
    return response["data"]


def query_replay_instance(
    project_id: int,
    replay_id: str,
    start: datetime,
    end: datetime,
):
    """Query aggregated replay instance."""
    response = query_replays_dataset(
        project_ids=[project_id],
        start=start,
        end=end,
        where=[
            Condition(Column("replay_id"), Op.EQ, replay_id),
        ],
        having=[],
        fields=[],
        sorting=[],
        pagination=None,
        search_filters=[],
    )
    return response["data"]


def query_replays_dataset(
    project_ids: List[str],
    start: datetime,
    end: datetime,
    where: List[Condition],
    having: List[Condition],
    fields: List[str],
    sorting: List[OrderBy],
    pagination: Optional[Paginators],
    search_filters: List[SearchFilter],
):
    query_options = {}

    # Instance requests do not paginate.
    if pagination:
        query_options["limit"] = Limit(pagination.limit)
        query_options["offset"] = Offset(pagination.offset)

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=make_select_statement(fields, sorting, search_filters),
            # Be careful adding conditions to this query.  You must only filter by columns that
            # are true for every column in the set!
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                # We don't actually know when a replay is finished ingesting until we reach the
                # end of the dataset.  For this reason we scan to the end and then in the having
                # clause we ask if the replay is in range.  This is more expensive but is required
                # to ensure correct operation and is especially pertinent in the case where an
                # archive request was submitted.
                #
                # Hard deletes may be more appropriate for replays than archival records.
                Condition(Column("timestamp"), Op.LT, datetime.now()),
                Condition(Column("timestamp"), Op.GTE, start),
                *where,
            ],
            having=[
                # Must include the first sequence otherwise the replay is too old.
                Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0),
                # Make sure we're not too old.
                Condition(Column("finished_at"), Op.LT, end),
                # Require non-archived replays.
                Condition(Column("isArchived"), Op.EQ, 0),
                # User conditions.
                *generate_valid_conditions(search_filters, query_config=ReplayQueryConfig()),
                # Other conditions.
                *having,
            ],
            orderby=sorting,
            groupby=[Column("replay_id")],
            granularity=Granularity(3600),
            **query_options,
        ),
    )
    return raw_snql_query(snuba_request, "replays.query.query_replays_dataset")


def query_replays_count(
    project_ids: List[str],
    start: datetime,
    end: datetime,
    replay_ids: List[str],
):

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                _strip_uuid_dashes("replay_id", Column("replay_id")),
                Function(
                    "notEmpty",
                    parameters=[Function("groupArray", parameters=[Column("is_archived")])],
                    alias="is_archived",
                ),
            ],
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("replay_id"), Op.IN, replay_ids),
            ],
            having=[
                # Must include the first sequence otherwise the replay is too old.
                Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0),
                # Require non-archived replays.
                Condition(Column("is_archived"), Op.EQ, 0),
            ],
            orderby=[],
            groupby=[Column("replay_id")],
            granularity=Granularity(3600),
        ),
    )
    return raw_snql_query(
        snuba_request, referrer="replays.query.query_replays_count", use_cache=True
    )


def query_replays_dataset_tagkey_values(
    project_ids: List[str],
    start: datetime,
    end: datetime,
    environment: str | None,
    tag_key: str,
):
    """Query replay tagkey values. Like our other tag functionality, aggregates do not work here."""

    where = []

    if environment:
        where.append(Condition(Column("environment"), Op.IN, environment))

    grouped_column = TAG_QUERY_ALIAS_COLUMN_MAP.get(tag_key)
    if grouped_column is None:
        # see https://clickhouse.com/docs/en/sql-reference/functions/array-join/
        # for arrayJoin behavior. we use it to return a flattened
        # row for each value in the tags.value array
        aggregated_column = Function(
            "arrayJoin",
            parameters=[all_values_for_tag_key(tag_key, Column("tags.key"), Column("tags.value"))],
            alias="tag_value",
        )
        grouped_column = Column("tag_value")

    else:
        # using identity to alias the column
        aggregated_column = Function("identity", parameters=[grouped_column], alias="tag_value")

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                Function("uniq", parameters=[Column("replay_id")], alias="times_seen"),
                Function("min", parameters=[Column("timestamp")], alias="first_seen"),
                Function("max", parameters=[Column("timestamp")], alias="last_seen"),
                aggregated_column,
            ],
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("is_archived"), Op.IS_NULL),
                *where,
            ],
            orderby=[OrderBy(Column("times_seen"), Direction.DESC)],
            groupby=[grouped_column],
            granularity=Granularity(3600),
            limit=Limit(1000),
        ),
    )
    return raw_snql_query(
        snuba_request, referrer="replays.query.query_replays_dataset_tagkey_values", use_cache=True
    )


def make_select_statement(
    fields: List[str],
    sorting: List[OrderBy],
    search_filters: List[Union[SearchFilter, str, ParenExpression]],
) -> List[Union[Column, Function]]:
    """Return the selection that forms the base of our replays response payload."""
    if not fields:
        return QUERY_ALIAS_COLUMN_MAP.values()

    unique_fields = set(fields)

    # Select fields used for filtering.
    #
    # These fields can filter a query without being selected.  However, if we did not select these
    # values we could not reuse those columns which are expensive to calculate.  This coupled with
    # the complexity of dependency management means we filter these columns manually in the final
    # output.
    for fltr in search_filters:
        if isinstance(fltr, SearchFilter):
            unique_fields.add(fltr.key.name)
        elif isinstance(fltr, ParenExpression):
            for f in _extract_children(fltr):
                unique_fields.add(f.key.name)

    # Select fields used for sorting.
    for sort in sorting:
        unique_fields.add(sort.exp.name)

    return select_from_fields(list(unique_fields))


def _grouped_unique_values(
    column_name: str, alias: Optional[str] = None, aliased: bool = False
) -> Function:
    """Returns an array of unique, non-null values.

    E.g.
        [1, 2, 2, 3, 3, 3, null] => [1, 2, 3]
    """
    return Function(
        "groupUniqArray",
        parameters=[Column(column_name)],
        alias=alias or column_name if aliased else None,
    )


def _grouped_unique_scalar_value(
    column_name: str, alias: Optional[str] = None, aliased: bool = True
) -> Function:
    """Returns the first value of a unique array.

    E.g.
        [1, 2, 2, 3, 3, 3, null] => [1, 2, 3] => 1
    """
    return Function(
        "arrayElement",
        parameters=[_grouped_unique_values(column_name), 1],
        alias=alias or column_name if aliased else None,
    )


def _sorted_aggregated_urls(agg_urls_column, alias):
    mapped_urls = Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["url_tuple"], Function("tupleElement", parameters=[Identifier("url_tuple"), 2])
            ),
            agg_urls_column,
        ],
    )
    mapped_sequence_ids = Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["url_tuple"], Function("tupleElement", parameters=[Identifier("url_tuple"), 1])
            ),
            agg_urls_column,
        ],
    )
    return Function(
        "arrayFlatten",
        parameters=[
            Function(
                "arraySort",
                parameters=[
                    Lambda(
                        ["urls", "sequence_id"],
                        Function("identity", parameters=[Identifier("sequence_id")]),
                    ),
                    mapped_urls,
                    mapped_sequence_ids,
                ],
            )
        ],
        alias=alias,
    )


# Filter

replay_url_parser_config = SearchConfig(
    numeric_keys={"duration", "count_errors", "count_segments", "count_urls", "activity"},
)


class ReplayQueryConfig(QueryConfig):
    # Numeric filters.
    duration = Number()
    count_errors = Number(query_alias="count_errors")
    count_segments = Number(query_alias="count_segments")
    count_urls = Number(query_alias="count_urls")
    activity = Number()

    # String filters.
    replay_id = String(field_alias="id")
    replay_type = String(query_alias="replay_type")
    platform = String()
    releases = ListField()
    release = ListField(query_alias="releases")
    dist = String()
    error_ids = ListField(query_alias="error_ids", is_uuid=True)
    error_id = ListField(query_alias="error_ids", is_uuid=True)
    trace_ids = ListField(query_alias="trace_ids", is_uuid=True)
    trace_id = ListField(query_alias="trace_ids", is_uuid=True)
    trace = ListField(query_alias="trace_ids", is_uuid=True)
    urls = ListField(query_alias="urls_sorted")
    url = ListField(query_alias="urls_sorted")
    user_id = String(field_alias="user.id", query_alias="user_id")
    user_email = String(field_alias="user.email", query_alias="user_email")
    user_name = String(field_alias="user.name", query_alias="user_name")
    user_ip_address = String(field_alias="user.ip", query_alias="user_ip")
    os_name = String(field_alias="os.name", query_alias="os_name")
    os_version = String(field_alias="os.version", query_alias="os_version")
    browser_name = String(field_alias="browser.name", query_alias="browser_name")
    browser_version = String(field_alias="browser.version", query_alias="browser_version")
    device_name = String(field_alias="device.name", query_alias="device_name")
    device_brand = String(field_alias="device.brand", query_alias="device_brand")
    device_family = String(field_alias="device.family", query_alias="device_family")
    device_model = String(field_alias="device.model", query_alias="device_model")
    sdk_name = String(field_alias="sdk.name", query_alias="sdk_name")
    sdk_version = String(field_alias="sdk.version", query_alias="sdk_version")

    # These are object-type fields.  User's who query by these fields are likely querying by
    # the "name" value.
    user = String(field_alias="user", query_alias="user_name")
    os = String(field_alias="os", query_alias="os_name")
    browser = String(field_alias="browser", query_alias="browser_name")
    device = String(field_alias="device", query_alias="device_name")
    sdk = String(field_alias="sdk", query_alias="sdk_name")

    # Tag
    tags = Tag(field_alias="*")

    # Sort keys
    agg_environment = String(field_alias="environment", is_filterable=False)
    started_at = String(is_filterable=False)
    finished_at = String(is_filterable=False)
    # Dedicated url parameter should be used.
    project_id = String(query_alias="projectId", is_filterable=False)
    project = String(query_alias="projectId", is_filterable=False)


# Pagination.


def make_pagination_values(limit: Any, offset: Any) -> Paginators:
    """Return a tuple of limit, offset values."""
    limit = _coerce_to_integer_default(limit, DEFAULT_PAGE_SIZE)
    if limit > MAX_PAGE_SIZE or limit < 0:
        limit = DEFAULT_PAGE_SIZE

    offset = _coerce_to_integer_default(offset, DEFAULT_OFFSET)
    return Paginators(limit, offset)


def _coerce_to_integer_default(value: Optional[str], default: int) -> int:
    """Return an integer or default."""
    if value is None:
        return default

    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _strip_uuid_dashes(
    input_name: str,
    input_value: Expression,
    alias: Optional[str] = None,
    aliased: bool = True,
):
    return Function(
        "replaceAll",
        parameters=[Function("toString", parameters=[input_value]), "-", ""],
        alias=alias or input_name if aliased else None,
    )


def _activity_score():
    #  taken from frontend calculation:
    #  score = (count_errors * 25 + pagesVisited * 5 ) / 10;
    #  score = Math.floor(Math.min(10, Math.max(1, score)));

    error_weight = Function(
        "multiply",
        parameters=[Column("count_errors"), 25],
    )
    pages_visited_weight = Function(
        "multiply",
        parameters=[
            Function(
                "length",
                parameters=[Column("urls_sorted")],
            ),
            5,
        ],
    )

    combined_weight = Function(
        "plus",
        parameters=[
            error_weight,
            pages_visited_weight,
        ],
    )

    combined_weight_normalized = Function(
        "intDivOrZero",
        parameters=[
            combined_weight,
            10,
        ],
    )

    return Function(
        "floor",
        parameters=[
            Function(
                "greatest",
                parameters=[
                    1,
                    Function(
                        "least",
                        parameters=[
                            10,
                            combined_weight_normalized,
                        ],
                    ),
                ],
            )
        ],
        alias="activity",
    )


# A mapping of marshalable fields and theirs dependencies represented as query aliases.  If a
# column is added which depends on another column, you must add it to this mapping.
#
# This mapping represents the minimum number of columns required to satisfy a field.  Without this
# mapping we would need to select all of the fields in order to ensure that dependent fields do
# not raise exceptions when their dependencies are not included.
#
# If a mapping is left as `[]` the query-alias will default to the field name.

FIELD_QUERY_ALIAS_MAP: Dict[str, List[str]] = {
    "id": ["replay_id"],
    "replay_type": ["replay_type"],
    "project_id": ["project_id"],
    "project": ["project_id"],
    "platform": ["platform"],
    "environment": ["agg_environment"],
    "releases": ["releases"],
    "release": ["releases"],
    "dist": ["dist"],
    "trace_ids": ["trace_ids"],
    "trace_id": ["trace_ids"],
    "trace": ["trace_ids"],
    "error_ids": ["error_ids"],
    "error_id": ["error_ids"],
    "started_at": ["started_at"],
    "finished_at": ["finished_at"],
    "duration": ["duration", "started_at", "finished_at"],
    "urls": ["urls_sorted", "agg_urls"],
    "url": ["urls_sorted", "agg_urls"],
    "count_errors": ["count_errors"],
    "count_urls": ["count_urls", "urls_sorted", "agg_urls"],
    "count_segments": ["count_segments"],
    "is_archived": ["is_archived"],
    "activity": ["activity", "count_errors", "urls_sorted", "agg_urls"],
    "user": ["user_id", "user_email", "user_name", "user_ip"],
    "os": ["os_name", "os_version"],
    "browser": ["browser_name", "browser_version"],
    "device": ["device_name", "device_brand", "device_family", "device_model"],
    "sdk": ["sdk_name", "sdk_version"],
    "tags": ["tags.key", "tags.value"],
    # Nested fields.  Useful for selecting searchable fields.
    "user.id": ["user_id"],
    "user.email": ["user_email"],
    "user.name": ["user_name"],
    "user.ip": ["user_ip"],
    "os.name": ["os_name"],
    "os.version": ["os_version"],
    "browser.name": ["browser_name"],
    "browser.version": ["browser_version"],
    "device.name": ["device_name"],
    "device.brand": ["device_brand"],
    "device.family": ["device_family"],
    "device.model": ["device_model"],
    "sdk.name": ["sdk_name"],
    "sdk.version": ["sdk_version"],
}


# A flat mapping of query aliases to column instances.  To maintain consistency, the key must
# match the column's query alias.

QUERY_ALIAS_COLUMN_MAP = {
    "replay_id": _strip_uuid_dashes("replay_id", Column("replay_id")),
    "replay_type": _grouped_unique_scalar_value(column_name="replay_type", alias="replay_type"),
    "project_id": Function(
        "toString",
        parameters=[_grouped_unique_scalar_value(column_name="project_id", alias="agg_pid")],
        alias="projectId",
    ),
    "platform": _grouped_unique_scalar_value(column_name="platform"),
    "agg_environment": _grouped_unique_scalar_value(
        column_name="environment", alias="agg_environment"
    ),
    "releases": _grouped_unique_values(column_name="release", alias="releases", aliased=True),
    "dist": _grouped_unique_scalar_value(column_name="dist"),
    "trace_ids": Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["trace_id"],
                _strip_uuid_dashes("trace_id", Identifier("trace_id")),
            ),
            Function(
                "groupUniqArrayArray",
                parameters=[Column("trace_ids")],
            ),
        ],
        alias="traceIds",
    ),
    "error_ids": Function(
        "arrayMap",
        parameters=[
            Lambda(["error_id"], _strip_uuid_dashes("error_id", Identifier("error_id"))),
            Function(
                "groupUniqArrayArray",
                parameters=[Column("error_ids")],
            ),
        ],
        alias="errorIds",
    ),
    "started_at": Function(
        "min", parameters=[Column("replay_start_timestamp")], alias="started_at"
    ),
    "finished_at": Function("max", parameters=[Column("timestamp")], alias="finished_at"),
    # Because duration considers the max timestamp, archive requests can alter the duration.
    "duration": Function(
        "dateDiff",
        parameters=["second", Column("started_at"), Column("finished_at")],
        alias="duration",
    ),
    "urls_sorted": _sorted_aggregated_urls(Column("agg_urls"), "urls_sorted"),
    "agg_urls": Function(
        "groupArray",
        parameters=[Function("tuple", parameters=[Column("segment_id"), Column("urls")])],
        alias="agg_urls",
    ),
    "count_segments": Function("count", parameters=[Column("segment_id")], alias="count_segments"),
    "count_errors": Function(
        "uniqArray",
        parameters=[Column("error_ids")],
        alias="count_errors",
    ),
    "count_urls": Function(
        "length",
        parameters=[Column("urls_sorted")],
        alias="count_urls",
    ),
    "is_archived": Function(
        "notEmpty",
        parameters=[Function("groupArray", parameters=[Column("is_archived")])],
        alias="isArchived",
    ),
    "activity": _activity_score(),
    "user_id": _grouped_unique_scalar_value(column_name="user_id"),
    "user_email": _grouped_unique_scalar_value(column_name="user_email"),
    "user_name": _grouped_unique_scalar_value(column_name="user_name"),
    "user_ip": Function(
        "IPv4NumToString",
        parameters=[
            _grouped_unique_scalar_value(
                column_name="ip_address_v4",
                aliased=False,
            )
        ],
        alias="user_ip",
    ),
    "os_name": _grouped_unique_scalar_value(column_name="os_name"),
    "os_version": _grouped_unique_scalar_value(column_name="os_version"),
    "browser_name": _grouped_unique_scalar_value(column_name="browser_name"),
    "browser_version": _grouped_unique_scalar_value(column_name="browser_version"),
    "device_name": _grouped_unique_scalar_value(column_name="device_name"),
    "device_brand": _grouped_unique_scalar_value(column_name="device_brand"),
    "device_family": _grouped_unique_scalar_value(column_name="device_family"),
    "device_model": _grouped_unique_scalar_value(column_name="device_model"),
    "sdk_name": _grouped_unique_scalar_value(column_name="sdk_name"),
    "sdk_version": _grouped_unique_scalar_value(column_name="sdk_version"),
    "tk": Function("groupArrayArray", parameters=[Column("tags.key")], alias="tk"),
    "tv": Function("groupArrayArray", parameters=[Column("tags.value")], alias="tv"),
}


TAG_QUERY_ALIAS_COLUMN_MAP = {
    "replay_type": Column("replay_type"),
    "platform": Column("platform"),
    "environment": Column("environment"),
    "release": Column("release"),
    "dist": Column("dist"),
    "url": Function("arrayJoin", parameters=[Column("urls")]),
    "user.id": Column("user_id"),
    "user.username": Column("user_name"),
    "user.email": Column("user_email"),
    "user.ip": Function(
        "IPv4NumToString",
        parameters=[Column("ip_address_v4")],
    ),
    "sdk.name": Column("sdk_name"),
    "sdk.version": Column("sdk_version"),
    "os.name": Column("os_name"),
    "os.version": Column("os_version"),
    "browser.name": Column("browser_name"),
    "browser.version": Column("browser_version"),
    "device.name": Column("device_name"),
    "device.brand": Column("device_brand"),
    "device.family": Column("device_family"),
    "device.model_id": Column("device_model"),
}


def collect_aliases(fields: List[str]) -> List[str]:
    """Return a unique list of aliases required to satisfy the fields."""
    # Required fields.
    result = {"is_archived", "finished_at", "agg_environment"}

    saw_tags = False
    for field in fields:
        aliases = FIELD_QUERY_ALIAS_MAP.get(field, None)
        if aliases is None:
            saw_tags = True
            continue
        for alias in aliases:
            result.add(alias)

    if saw_tags:
        result.add("tk")
        result.add("tv")

    return list(result)


def select_from_fields(fields: List[str]) -> List[Union[Column, Function]]:
    """Return a list of columns to select."""
    return [QUERY_ALIAS_COLUMN_MAP[alias] for alias in collect_aliases(fields)]


def _extract_children(expression: ParenExpression) -> Generator[None, None, str]:
    for child in expression.children:
        if isinstance(child, SearchFilter):
            yield child
        elif isinstance(child, ParenExpression):
            yield from _extract_children(child)
