from collections import namedtuple
from datetime import datetime
from typing import Any, List, Optional, Union

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

from sentry.api.event_search import SearchConfig, SearchFilter
from sentry.replays.lib.query import (
    ListField,
    Number,
    QueryConfig,
    String,
    Tag,
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
    sort: Optional[str],
    limit: Optional[str],
    offset: Optional[str],
    search_filters: List[SearchFilter],
) -> dict:
    """Query aggregated replay collection."""
    conditions = []
    if environment:
        conditions.append(Condition(Column("environment"), Op.IN, environment))

    sort_ordering = get_valid_sort_commands(
        sort,
        default=OrderBy(Column("startedAt"), Direction.DESC),
        query_config=ReplayQueryConfig(),
    )
    paginators = make_pagination_values(limit, offset)

    response = query_replays_dataset(
        project_ids=project_ids,
        start=start,
        end=end,
        where=conditions,
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
            select=make_select_statement(),
            where=[
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("timestamp"), Op.LT, end),
                Condition(Column("timestamp"), Op.GTE, start),
                *where,
            ],
            having=[
                # Must include the first sequence otherwise the replay is too old.
                Condition(Function("min", parameters=[Column("segment_id")]), Op.EQ, 0),
                # Discard short replays (5 seconds by arbitrary decision).
                Condition(Column("duration"), Op.GTE, 5),
                # Require non-archived replays.
                Condition(Column("isArchived"), Op.EQ, 0),
                # User conditions.
                *generate_valid_conditions(search_filters, query_config=ReplayQueryConfig()),
            ],
            orderby=sorting,
            groupby=[Column("replay_id")],
            granularity=Granularity(3600),
            **query_options,
        ),
    )
    return raw_snql_query(snuba_request)


# Select.


def make_select_statement() -> List[Union[Column, Function]]:
    """Return the selection that forms the base of our replays response payload."""
    return [
        _strip_uuid_dashes("replay_id", Column("replay_id")),
        # First, non-null value of a collected array.
        _grouped_unique_scalar_value(column_name="title"),
        Function(
            "toString",
            parameters=[_grouped_unique_scalar_value(column_name="project_id", alias="agg_pid")],
            alias="projectId",
        ),
        _grouped_unique_scalar_value(column_name="platform"),
        _grouped_unique_scalar_value(column_name="environment", alias="agg_environment"),
        _grouped_unique_values(column_name="release", alias="releases", aliased=True),
        _grouped_unique_scalar_value(column_name="dist"),
        _grouped_unique_scalar_value(column_name="user_id"),
        _grouped_unique_scalar_value(column_name="user_email"),
        _grouped_unique_scalar_value(column_name="user_name"),
        Function(
            "IPv4NumToString",
            parameters=[
                _grouped_unique_scalar_value(
                    column_name="ip_address_v4",
                    aliased=False,
                )
            ],
            alias="user_ipAddress",
        ),
        _grouped_unique_scalar_value(column_name="os_name"),
        _grouped_unique_scalar_value(column_name="os_version"),
        _grouped_unique_scalar_value(column_name="browser_name"),
        _grouped_unique_scalar_value(column_name="browser_version"),
        _grouped_unique_scalar_value(column_name="device_name"),
        _grouped_unique_scalar_value(column_name="device_brand"),
        _grouped_unique_scalar_value(column_name="device_family"),
        _grouped_unique_scalar_value(column_name="device_model"),
        _grouped_unique_scalar_value(column_name="sdk_name"),
        _grouped_unique_scalar_value(column_name="sdk_version"),
        # Flatten array of arrays.
        Function(
            "groupArrayArray",
            parameters=[Column("tags.key")],
            alias="tk",
        ),
        Function(
            "groupArrayArray",
            parameters=[Column("tags.value")],
            alias="tv",
        ),
        Function(
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
        Function(
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
        # Aggregations.
        Function("min", parameters=[Column("replay_start_timestamp")], alias="startedAt"),
        Function("max", parameters=[Column("timestamp")], alias="finishedAt"),
        Function(
            "dateDiff",
            parameters=["second", Column("startedAt"), Column("finishedAt")],
            alias="duration",
        ),
        Function(
            "groupArray",
            parameters=[Function("tuple", parameters=[Column("segment_id"), Column("urls")])],
            alias="agg_urls",
        ),
        _sorted_aggregated_urls(Column("agg_urls"), "urls_sorted"),
        Function("count", parameters=[Column("segment_id")], alias="countSegments"),
        Function(
            "uniqArray",
            parameters=[Column("error_ids")],
            alias="countErrors",
        ),
        Function(
            "notEmpty",
            parameters=[Function("groupArray", parameters=[Column("is_archived")])],
            alias="isArchived",
        ),
    ]


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
    numeric_keys={"duration", "countErrors", "countSegments"},
)


class ReplayQueryConfig(QueryConfig):
    # Numeric filters.
    duration = Number()
    count_errors = Number(name="countErrors")
    count_segments = Number(name="countSegments")

    # String filters.
    replay_id = String(field_alias="id")
    platform = String()
    agg_environment = String(field_alias="environment")
    releases = ListField()
    dist = String()
    urls = ListField(query_alias="urls_sorted")
    user_id = String(field_alias="user.id")
    user_email = String(field_alias="user.email")
    user_name = String(field_alias="user.name")
    user_ip_address = String(field_alias="user.ipAddress", query_alias="user_ipAddress")
    os_name = String(field_alias="os.name")
    os_version = String(field_alias="os.version")
    browser_name = String(field_alias="browser.name")
    browser_version = String(field_alias="browser.version")
    device_name = String(field_alias="device.name")
    device_brand = String(field_alias="device.brand")
    device_family = String(field_alias="device.family")
    device_model = String(field_alias="device.model")
    sdk_name = String(field_alias="sdk.name")
    sdk_version = String(field_alias="sdk.version")

    # Tag
    tags = Tag(field_alias="*")

    # Sort keys
    started_at = String(name="startedAt", is_filterable=False)
    finished_at = String(name="finishedAt", is_filterable=False)
    # Dedicated url parameter should be used.
    project_id = String(field_alias="projectId", query_alias="projectId", is_filterable=False)


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
