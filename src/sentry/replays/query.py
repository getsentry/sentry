from collections import namedtuple
from datetime import datetime
from typing import Any, List, Optional, Union

from snuba_sdk import Column, Function, Identifier, Lambda
from snuba_sdk.orderby import Direction, OrderBy

from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_query

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 10
DEFAULT_OFFSET = 0

Paginators = namedtuple("Paginators", ("limit", "offset"))


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
    filter_keys = {"project_id": project_ids}
    if environment:
        filter_keys["environment"] = environment

    sort_ordering = make_sort_ordering(sort)
    paginators = make_pagination_values(limit, offset)

    response = raw_query(
        dataset=Dataset.Replays,
        selected_columns=make_select_statement(),
        limit=paginators.limit,
        offset=paginators.offset,
        sort=sort_ordering,
        conditions=[["timestamp", ">=", start], ["timestamp", "<", end]],
        filter_keys=filter_keys,
        groupby=[Column("replay_id")],
    )
    return response["data"]


def query_replay_instance(
    project_id: int,
    replay_id: str,
    start: datetime,
    end: datetime,
):
    """Query aggregated replay instance."""
    response = raw_query(
        dataset=Dataset.Replays,
        selected_columns=make_select_statement(),
        conditions=[["timestamp", ">=", start], ["timestamp", "<", end]],
        filter_keys={"project_id": [project_id], "replay_id": replay_id},
        groupby=[Column("replay_id")],
    )
    return response["data"]


# Select.


def make_select_statement() -> List[Union[Column, Function]]:
    """Return the selection that forms the base of our replays response payload."""
    return [
        Column("replay_id"),
        # First, non-null value of a collected array.
        _grouped_unique_scalar_value(column_name="title"),
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
        _grouped_unique_scalar_value(column_name="tags.key"),
        _grouped_unique_scalar_value(column_name="tags.value"),
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
        # Aggregations.
        Function("min", parameters=[Column("timestamp")], alias="started_at"),
        Function("max", parameters=[Column("timestamp")], alias="finished_at"),
        Function(
            "dateDiff",
            parameters=["second", Column("started_at"), Column("finished_at")],
            alias="duration",
        ),
        Function("groupArray", parameters=[Column("url")], alias="urls"),
        Function("count", parameters=[Column("url")], alias="count_urls"),
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
