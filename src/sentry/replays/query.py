from __future__ import annotations

from collections import namedtuple
from datetime import datetime
from typing import Any, Dict, Generator, List, Optional, Union

from rest_framework.exceptions import ParseError
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

from sentry import features
from sentry.api.event_search import ParenExpression, SearchConfig, SearchFilter
from sentry.models.organization import Organization
from sentry.replays.lib.query import (
    InvalidField,
    IPAddress,
    ListField,
    Number,
    QueryConfig,
    Selector,
    String,
    Tag,
    UUIDField,
    all_values_for_tag_key,
    generate_valid_conditions,
    get_valid_sort_commands,
)
from sentry.utils.snuba import raw_snql_query

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 10
DEFAULT_OFFSET = 0
MAX_REPLAY_LENGTH_HOURS = 1
ELIGIBLE_SUBQUERY_SORTS = {"started_at", "browser.name", "os.name"}
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
    organization: Optional[Organization] = None,
    actor: Optional[Any] = None,
) -> dict:
    """Query aggregated replay collection."""
    if organization:
        tenant_ids = {"organization_id": organization.id}
    else:
        tenant_ids = {}

    conditions = []
    if environment:
        conditions.append(Condition(Column("agg_environment"), Op.IN, environment))

    paginators = make_pagination_values(limit, offset)

    # Attempt to eager return with subquery.
    if features.has("organizations:session-replay-index-subquery", organization, actor=actor):
        try:
            response = query_replays_dataset_with_subquery(
                project_ids=project_ids,
                start=start,
                end=end,
                fields=fields,
                environments=environment,
                search_filters=search_filters,
                sort=sort,
                pagination=paginators,
                tenant_ids=tenant_ids,
            )
            return response["data"]
        except ParseError:
            # Subquery could not continue because it found search filters which required
            # aggregation to satisfy.
            pass

    response = query_replays_dataset(
        project_ids=project_ids,
        start=start,
        end=end,
        where=[],
        having=conditions,
        fields=fields,
        pagination=paginators,
        search_filters=search_filters,
        sort=sort,
        tenant_ids=tenant_ids,
    )
    return response["data"]


def query_replay_instance(
    project_id: int | list[int],
    replay_id: str,
    start: datetime,
    end: datetime,
    tenant_ids: dict[str, Any],
):
    """Query aggregated replay instance."""
    response = query_replays_dataset(
        project_ids=[project_id] if isinstance(project_id, int) else project_id,
        start=start,
        end=end,
        where=[
            Condition(Column("replay_id"), Op.EQ, replay_id),
        ],
        having=[Condition(Column("isArchived"), Op.EQ, 0)],
        fields=[],
        sort=None,
        pagination=None,
        search_filters=[],
        tenant_ids=tenant_ids,
    )
    return response["data"]


def query_replays_dataset(
    project_ids: List[str],
    start: datetime,
    end: datetime,
    where: List[Condition],
    having: List[Condition],
    fields: List[str],
    pagination: Optional[Paginators],
    search_filters: List[SearchFilter],
    sort: Optional[str],
    tenant_ids: dict[str, Any] | None = None,
):
    query_options = {}

    # Instance requests do not paginate.
    if pagination:
        query_options["limit"] = Limit(pagination.limit)
        query_options["offset"] = Offset(pagination.offset)

    sorting = get_valid_sort_commands(
        sort,
        default=OrderBy(Column("started_at"), Direction.DESC),
        query_config=ReplayQueryConfig(),
    )

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
                # User conditions.
                *generate_valid_conditions(search_filters, query_config=ReplayQueryConfig()),
                # Other conditions.
                *having,
            ],
            orderby=sorting,
            groupby=[Column("project_id"), Column("replay_id")],
            granularity=Granularity(3600),
            **query_options,
        ),
        tenant_ids=tenant_ids,
    )
    return raw_snql_query(snuba_request, "replays.query.query_replays_dataset")


def query_replays_dataset_with_subquery(
    project_ids: List[str],
    start: datetime,
    end: datetime,
    environments: List[str],
    search_filters: List[SearchFilter],
    sort: Optional[str],
    fields: List[str],
    pagination: Optional[Paginators],
    tenant_ids: dict[str, Any] | None = None,
):
    conditions = generate_valid_conditions(search_filters, query_config=ReplaySubqueryConfig())
    if environments:
        conditions.append(Condition(Column("environment"), Op.IN, environments))

    sorting = get_valid_sort_commands(
        sort,
        default=OrderBy(Column("started_at"), Direction.DESC),
        query_config=ReplaySubqueryConfig(),
    )

    subquery_snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                Column("replay_id"),
                Column("timestamp"),
                Function(
                    "identity", parameters=[Column("replay_start_timestamp")], alias="started_at"
                ),
            ],
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("segment_id"), Op.EQ, 0),
                *conditions,
            ],
            orderby=sorting,
            granularity=Granularity(3600),
            limit=Limit(pagination.limit),
            offset=Offset(pagination.offset),
        ),
        tenant_ids=tenant_ids,
    )

    replay_ids_to_filter_results = raw_snql_query(
        subquery_snuba_request, "replays.query.query_replays_dataset_subquery"
    )

    if len(replay_ids_to_filter_results["data"]) == 0:
        # if no results, no need to carry on
        return {"data": []}
    min_subquery_ts = datetime.now().timestamp()
    replay_ids_to_filter = []

    for replay in replay_ids_to_filter_results["data"]:
        ts = int(datetime.fromisoformat(replay["timestamp"]).timestamp())
        replay_ids_to_filter.append(replay["replay_id"])
        min_subquery_ts = min(min_subquery_ts, ts)

    # do the full query to get all aggregated fields
    sorting = get_valid_sort_commands(
        sort,
        default=OrderBy(Column("started_at"), Direction.DESC),
        query_config=ReplayQueryConfig(),
    )

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=make_select_statement(fields, sorting, []),
            # these should be the only filters in this query,
            # as all previous filters should have been done subquery,
            # so project_id, timestamp and replay_id are only filters
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("replay_id"), Op.IN, replay_ids_to_filter),
                Condition(
                    Column("timestamp"),
                    Op.GTE,
                    datetime.fromtimestamp(min_subquery_ts),
                ),
                Condition(Column("timestamp"), Op.LT, datetime.now()),
            ],
            orderby=sorting,
            groupby=[Column("project_id"), Column("replay_id")],
            granularity=Granularity(3600),
            # this second query doesn't need offsetting / limits, as those are handled by the first query
        ),
        tenant_ids=tenant_ids,
    )
    return raw_snql_query(snuba_request, "replays.query.query_replays_dataset")


def query_replays_count(
    project_ids: List[str],
    start: datetime,
    end: datetime,
    replay_ids: List[str],
    tenant_ids: dict[str, Any],
):

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=[
                _strip_uuid_dashes("replay_id", Column("replay_id")),
                Function(
                    "ifNull",
                    parameters=[
                        Function(
                            "max",
                            parameters=[Column("is_archived")],
                        ),
                        0,
                    ],
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
        tenant_ids=tenant_ids,
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
    tenant_ids: dict[str, Any] | None,
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
        tenant_ids=tenant_ids,
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


def take_any_from_aggregation(
    column_name: str,
    alias: Optional[str] = None,
    aliased: bool = True,
) -> Function:
    """Returns any value of a non group-by field. in our case, they are always the same,
    so the value should be consistent.
    """
    return Function(
        "any",
        parameters=[
            Column(column_name),
        ],
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
    replay_id = UUIDField(field_alias="id")
    replay_type = String(query_alias="replay_type")
    platform = String()
    releases = ListField()
    release = ListField(query_alias="releases")
    dist = String()
    error_ids = ListField(query_alias="errorIds")
    error_id = ListField(query_alias="errorIds")
    trace_ids = ListField(query_alias="traceIds")
    trace_id = ListField(query_alias="traceIds")
    trace = ListField(query_alias="traceIds")
    urls = ListField(query_alias="urls_sorted")
    url = ListField(query_alias="urls_sorted")
    user_id = String(field_alias="user.id", query_alias="user_id")
    user_email = String(field_alias="user.email", query_alias="user_email")
    user_username = String(field_alias="user.username")
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
    user = String(field_alias="user", query_alias="user_username")
    os = String(field_alias="os", query_alias="os_name")
    browser = String(field_alias="browser", query_alias="browser_name")
    device = String(field_alias="device", query_alias="device_name")
    sdk = String(field_alias="sdk", query_alias="sdk_name")

    # Click
    click_alt = ListField(field_alias="click.alt", is_sortable=False)
    click_class = ListField(field_alias="click.class", query_alias="clickClass", is_sortable=False)
    click_id = ListField(field_alias="click.id", is_sortable=False)
    click_aria_label = ListField(field_alias="click.label", is_sortable=False)
    click_role = ListField(field_alias="click.role", is_sortable=False)
    click_tag = ListField(field_alias="click.tag", is_sortable=False)
    click_testid = ListField(field_alias="click.testid", is_sortable=False)
    click_text = ListField(field_alias="click.textContent", is_sortable=False)
    click_title = ListField(field_alias="click.title", is_sortable=False)
    click_selector = Selector(field_alias="click.selector", is_sortable=False)

    # Tag
    tags = Tag(field_alias="*")

    # Sort keys
    agg_environment = String(field_alias="environment", is_filterable=False)
    started_at = String(is_filterable=False)
    finished_at = String(is_filterable=False)
    # Dedicated url parameter should be used.
    project_id = String(query_alias="project_id", is_filterable=False)
    project = String(query_alias="project_id", is_filterable=False)


class ReplaySubqueryConfig(QueryConfig):
    browser = String(field_alias="browser", query_alias="browser_name")
    browser_name = String(field_alias="browser.name")
    browser_version = String(field_alias="browser.version")
    device = String(field_alias="device", query_alias="device_name")
    device_brand = String(field_alias="device.brand")
    device_family = String(field_alias="device.family")
    device_model = String(field_alias="device.model")
    device_name = String(field_alias="device.name")
    dist = String()
    os = String(field_alias="os", query_alias="os_name")
    os_name = String(field_alias="os.name")
    os_version = String(field_alias="os.version")
    platform = String()
    project = String(query_alias="project_id")
    project_id = String()
    replay_id = UUIDField(field_alias="id")
    replay_type = String()
    sdk = String(field_alias="sdk", query_alias="sdk_name")
    sdk_name = String(field_alias="sdk.name")
    sdk_version = String(field_alias="sdk.version")
    started_at = String(is_filterable=False)
    user = String(field_alias="user", query_alias="user_name")
    user_email = String(field_alias="user.email")
    user_id = String(field_alias="user.id")
    user_ip_address = IPAddress(field_alias="user.ip", query_alias="ip_address_v4")
    user_name = String(field_alias="user.username")

    tags = Tag(field_alias="*", tag_key_alias="tags.key", tag_value_alias="tags.value")

    # we have to explicitly define the rest of the fields as invalid fields or else
    # they will be parsed as tags for the subquery
    releases = InvalidField()
    release = InvalidField()
    click_alt = InvalidField(field_alias="click.alt")
    click_class = InvalidField(field_alias="click.class", query_alias="clickClass")
    click_id = InvalidField(field_alias="click.id")
    click_aria_label = InvalidField(field_alias="click.label")
    click_role = InvalidField(field_alias="click.role")
    click_tag = InvalidField(field_alias="click.tag")
    click_testid = InvalidField(field_alias="click.testid")
    click_text = InvalidField(field_alias="click.textContent")
    click_title = InvalidField(field_alias="click.title")
    click_selector = InvalidField(field_alias="click.selector")
    duration = InvalidField()
    count_errors = InvalidField(query_alias="count_errors")
    count_segments = InvalidField(query_alias="count_segments")
    count_urls = InvalidField(query_alias="count_urls")
    activity = InvalidField()
    error_ids = InvalidField(query_alias="errorIds")
    error_id = InvalidField(query_alias="errorIds")
    trace_ids = InvalidField(query_alias="traceIds")
    trace_id = InvalidField(query_alias="traceIds")
    trace = InvalidField(query_alias="traceIds")
    urls = InvalidField(query_alias="urls_sorted")
    url = InvalidField(query_alias="urls_sorted")


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

    error_weight = Function("multiply", parameters=[Column("count_errors"), 25])
    pages_visited_weight = Function("multiply", parameters=[Column("count_urls"), 5])

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
    "count_urls": ["count_urls"],
    "count_segments": ["count_segments"],
    "is_archived": ["is_archived"],
    "activity": ["activity", "count_errors", "count_urls"],
    "user": ["user_id", "user_email", "user_username", "user_ip"],
    "os": ["os_name", "os_version"],
    "browser": ["browser_name", "browser_version"],
    "device": ["device_name", "device_brand", "device_family", "device_model"],
    "sdk": ["sdk_name", "sdk_version"],
    "tags": ["tk", "tv"],
    # Nested fields.  Useful for selecting searchable fields.
    "user.id": ["user_id"],
    "user.email": ["user_email"],
    "user.username": ["user_username"],
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
    # Click actions
    "click.alt": ["click.alt"],
    "click.label": ["click.aria_label"],
    "click.class": ["click.class"],
    "click.id": ["click.id"],
    "click.role": ["click.role"],
    "click.tag": ["click.tag"],
    "click.testid": ["click.testid"],
    "click.textContent": ["click.text"],
    "click.title": ["click.title"],
    "click.selector": [
        "click.alt",
        "click.aria_label",
        "click.classes",
        "click.id",
        "click.role",
        "click.tag",
        "click.testid",
        "click.text",
        "click.title",
    ],
}


# A flat mapping of query aliases to column instances.  To maintain consistency, the key must
# match the column's query alias.

QUERY_ALIAS_COLUMN_MAP = {
    "replay_id": Column("replay_id"),
    "project_id": Column("project_id"),
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
        "sum",
        parameters=[Function("length", parameters=[Column("error_ids")])],
        alias="count_errors",
    ),
    "count_urls": Function(
        "sum",
        parameters=[Function("length", parameters=[Column("urls")])],
        alias="count_urls",
    ),
    "is_archived": Function(
        "ifNull",
        parameters=[
            Function(
                "max",
                parameters=[Column("is_archived")],
            ),
            0,
        ],
        alias="isArchived",
    ),
    "activity": _activity_score(),
    "releases": _grouped_unique_values(column_name="release", alias="releases", aliased=True),
    "replay_type": take_any_from_aggregation(column_name="replay_type", alias="replay_type"),
    "platform": take_any_from_aggregation(column_name="platform"),
    "agg_environment": take_any_from_aggregation(
        column_name="environment", alias="agg_environment"
    ),
    "dist": take_any_from_aggregation(column_name="dist"),
    "user_id": take_any_from_aggregation(column_name="user_id"),
    "user_email": take_any_from_aggregation(column_name="user_email"),
    "user_username": take_any_from_aggregation(column_name="user_name", alias="user_username"),
    "user_ip": Function(
        "IPv4NumToString",
        parameters=[take_any_from_aggregation(column_name="ip_address_v4", aliased=False)],
        alias="user_ip",
    ),
    "os_name": take_any_from_aggregation(column_name="os_name"),
    "os_version": take_any_from_aggregation(column_name="os_version"),
    "browser_name": take_any_from_aggregation(column_name="browser_name"),
    "browser_version": take_any_from_aggregation(column_name="browser_version"),
    "device_name": take_any_from_aggregation(column_name="device_name"),
    "device_brand": take_any_from_aggregation(column_name="device_brand"),
    "device_family": take_any_from_aggregation(column_name="device_family"),
    "device_model": take_any_from_aggregation(column_name="device_model"),
    "sdk_name": take_any_from_aggregation(column_name="sdk_name"),
    "sdk_version": take_any_from_aggregation(column_name="sdk_version"),
    "tk": Function("groupArrayArray", parameters=[Column("tags.key")], alias="tk"),
    "tv": Function("groupArrayArray", parameters=[Column("tags.value")], alias="tv"),
    "click.alt": Function("groupArray", parameters=[Column("click_alt")], alias="click_alt"),
    "click.aria_label": Function(
        "groupArray", parameters=[Column("click_aria_label")], alias="click_aria_label"
    ),
    "click.class": Function(
        "groupArrayArray", parameters=[Column("click_class")], alias="clickClass"
    ),
    "click.classes": Function(
        "groupArray", parameters=[Column("click_class")], alias="click_classes"
    ),
    "click.id": Function("groupArray", parameters=[Column("click_id")], alias="click_id"),
    "click.role": Function("groupArray", parameters=[Column("click_role")], alias="click_role"),
    "click.tag": Function("groupArray", parameters=[Column("click_tag")], alias="click_tag"),
    "click.testid": Function(
        "groupArray", parameters=[Column("click_testid")], alias="click_testid"
    ),
    "click.text": Function("groupArray", parameters=[Column("click_text")], alias="click_text"),
    "click.title": Function("groupArray", parameters=[Column("click_title")], alias="click_title"),
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
