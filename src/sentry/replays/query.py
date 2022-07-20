from collections import namedtuple
from datetime import datetime, timedelta
from typing import Any, List, Optional, Union

import requests
from django.conf import settings
from snuba_sdk import (
    Column,
    Condition,
    Entity,
    Flags,
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
from snuba_sdk.orderby import Direction, OrderBy

# Constants.
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 10
DEFAULT_OFFSET = 0
SNUBA_URL = settings.SENTRY_SNUBA + "/replays/snql"

paginators = namedtuple("Paginators", ("limit", "offset"))


def query_replays_collection(
    project_ids: List[int],
    start: datetime,
    end: datetime,
    environment: Optional[str],
    sort: Optional[str],
    limit: Optional[str],
    offset: Optional[str],
) -> dict:
    """Query aggregated replay collection."""
    conditions = make_collection_default_filter_conditions(project_ids, start, end)
    if environment:
        conditions.append(Condition(Column("environment"), Op.EQ, environment))

    sort_ordering = make_sort_ordering(sort)
    paginators = make_pagination_values(limit, offset)

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=make_select_statement(),
            where=conditions,
            orderby=sort_ordering,
            groupby=[Column("replay_id")],
            limit=Limit(paginators.limit),
            offset=Offset(paginators.offset),
            granularity=Granularity(3600),
        ),
        flags=Flags(debug=True),
    )

    return query_snuba_replays_endpoint(request=snuba_request)


def query_replay_instance(
    project_id: int,
    replay_id: str,
    start: datetime,
    end: datetime,
):
    """Query aggregated replay instance."""
    conditions = make_instance_default_filter_conditions(project_id, start, end)
    conditions.append(Condition(Column("replay_id"), Op.EQ, replay_id))

    snuba_request = Request(
        dataset="replays",
        app_id="replay-backend-web",
        query=Query(
            match=Entity("replays"),
            select=make_select_statement(),
            where=conditions,
            groupby=[Column("replay_id")],
            granularity=Granularity(3600),
        ),
        flags=Flags(debug=True),
    )

    return query_snuba_replays_endpoint(request=snuba_request)


def query_snuba_replays_endpoint(request: Request) -> List[dict]:
    response = requests.post(url=SNUBA_URL, data=request.serialize())
    if response.status_code == 200:
        return response.json()["data"]

    raise Exception("Snuba could not be reached.")


# Select.


def make_select_statement() -> List[Union[Column, Function]]:
    """Return the selection that forms the base of our replays response payload."""
    return [
        Column("replay_id"),
        # First, non-null value of a collected array.
        _grouped_unique_scalar_value(column_name="title"),
        _grouped_unique_scalar_value(column_name="project_id"),
        _grouped_unique_scalar_value(column_name="platform"),
        _grouped_unique_scalar_value(column_name="environment"),
        _grouped_unique_scalar_value(column_name="release"),
        _grouped_unique_scalar_value(column_name="dist"),
        Function(
            "IPv4NumToString",
            parameters=[
                _grouped_unique_scalar_value(
                    column_name="ip_address_v4",
                    aliased=False,
                )
            ],
            alias="ip_address_v4",
        ),
        Function(
            "IPv6NumToString",
            parameters=[
                _grouped_unique_scalar_value(
                    column_name="ip_address_v6",
                    aliased=False,
                )
            ],
            alias="ip_address_v6",
        ),
        _grouped_unique_scalar_value(column_name="user"),
        _grouped_unique_scalar_value(column_name="user_id"),
        _grouped_unique_scalar_value(column_name="user_email"),
        _grouped_unique_scalar_value(column_name="user_hash"),
        _grouped_unique_scalar_value(column_name="user_name"),
        _grouped_unique_scalar_value(column_name="sdk_name"),
        _grouped_unique_scalar_value(column_name="sdk_version"),
        _grouped_unique_values(column_name="tags.key"),
        _grouped_unique_values(column_name="tags.value"),
        # Flatten array of arrays.
        Function(
            "arrayMap",
            parameters=[
                Lambda(
                    ["trace_id"],
                    Function("toString", parameters=[Identifier("trace_id")]),
                ),
                Function(
                    "groupUniqArrayArray",
                    parameters=[Column("trace_ids")],
                ),
            ],
            alias="trace_ids",
        ),
        #
        # TODO
        # Function("groupArray", parameters=[Column("url")], alias="urls"),
        # Function("count", parameters=[Column("url")], alias="count_urls"),
        #
        # Aggregations.
        Function("min", parameters=[Column("timestamp")], alias="started_at"),
        Function("max", parameters=[Column("timestamp")], alias="finished_at"),
        Function(
            "dateDiff",
            parameters=["second", Column("started_at"), Column("finished_at")],
            alias="duration",
        ),
        Function("count", parameters=[Column("sequence_id")], alias="count_sequences"),
    ]


def _grouped_unique_values(column_name: str, aliased: bool = False) -> Function:
    """Returns an array of unique, non-null values.

    E.g.
        [1, 2, 2, 3, 3, 3, null] => [1, 2, 3]
    """
    return Function(
        "groupUniqArray",
        parameters=[Column(column_name)],
        alias=column_name if aliased else None,
    )


def _grouped_unique_scalar_value(column_name: str, aliased: bool = True) -> Function:
    """Returns the first value of a unique array.

    E.g.
        [1, 2, 2, 3, 3, 3, null] => [1, 2, 3] => 1
    """
    return Function(
        "arrayElement",
        parameters=[_grouped_unique_values(column_name), 1],
        alias=column_name if aliased else None,
    )


# Filter.


def make_collection_default_filter_conditions(
    project_ids: List[int],
    start: datetime,
    end: datetime,
) -> List[Condition]:
    """Return the set of conditions to filter a collection query by."""
    conditions = _make_default_filter_conditions(start, end)
    conditions.append(Condition(Column("project_id"), Op.IN, project_ids))
    return conditions


def make_instance_default_filter_conditions(
    project_id: int,
    start: datetime,
    end: datetime,
) -> List[Condition]:
    """Return the set of conditions to filter an instance query by."""
    conditions = _make_default_filter_conditions(start, end)
    conditions.append(Condition(Column("project_id"), Op.EQ, project_id))
    return conditions


def _make_default_filter_conditions(start: datetime, end: datetime) -> List[Condition]:
    """Return the default set of conditions to filter by."""
    return [
        # Required for entity validation timestamp must not be in the
        # future.
        Condition(Column("timestamp"), Op.LT, end),
        # Bounded minimum to prevent us from blowing up clickhouse.
        Condition(Column("timestamp"), Op.GTE, start),
        # Feature request: replays must have a duration greater than 5
        # seconds.  Anything less than is useless.
        Condition(Column("duration"), Op.GTE, 5),
    ]


def _make_start_period(stats_period: Optional[str]) -> datetime:
    # stats_period defaults to one week if not provided.
    if not stats_period:
        return datetime.utcnow() - timedelta(days=7)

    # stats_period is an integer with a offset type suffix.
    stats_offset_str, stats_offset_type = stats_period[:-1], stats_period[-1]

    # Invalid integers default to one week.
    try:
        stats_offset = int(stats_offset_str)
    except (TypeError, ValueError):
        stats_offset = 7
        stats_offset_type = "d"

    if stats_offset_type == "s":
        offset = timedelta(seconds=stats_offset)
    elif stats_offset_type == "m":
        offset = timedelta(minutes=stats_offset)
    elif stats_offset_type == "h":
        offset = timedelta(hours=stats_offset)
    elif stats_offset_type == "d":
        offset = timedelta(days=stats_offset)
    elif stats_offset_type == "w":
        offset = timedelta(days=stats_offset * 7)
    else:
        offset = timedelta(days=7)

    return datetime.utcnow() - offset


# Sort.


def make_sort_ordering(sort: Optional[str]) -> List[OrderBy]:
    """Return the complete set of conditions to order our query by."""
    if sort == "started_at":
        orderby = [OrderBy(Column("started_at"), Direction.ASC)]
    elif sort == "finished_at":
        orderby = [OrderBy(Column("finished_at"), Direction.ASC)]
    elif sort == "-finished_at":
        orderby = [OrderBy(Column("finished_at"), Direction.DESC)]
    elif sort == "duration":
        orderby = [OrderBy(Column("duration"), Direction.ASC)]
    elif sort == "-duration":
        orderby = [OrderBy(Column("duration"), Direction.DESC)]
    else:
        # By default return the most recent replays.
        orderby = [OrderBy(Column("started_at"), Direction.DESC)]

    return orderby


# Pagination.


def make_pagination_values(limit: Any, offset: Any) -> paginators:
    """Return a tuple of limit, offset values."""
    limit = _coerce_to_integer_default(limit, DEFAULT_PAGE_SIZE)
    if limit > MAX_PAGE_SIZE or limit < 0:
        limit = DEFAULT_PAGE_SIZE

    offset = _coerce_to_integer_default(offset, DEFAULT_OFFSET)
    return paginators(limit, offset)


def _coerce_to_integer_default(value: Optional[str], default: int) -> int:
    """Return an integer or default."""
    if value is None:
        return default

    try:
        return int(value)
    except (ValueError, TypeError):
        return default
