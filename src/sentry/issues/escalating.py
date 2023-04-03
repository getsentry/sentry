from datetime import datetime, timedelta
from typing import List, Tuple

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.models import Group
from sentry.utils.json import JSONData
from sentry.utils.snuba import raw_snql_query

# This gets modified in tests to force a smaller limit
QUERY_LIMIT = 10000  # This is the maximum value for Snuba


def query_groups_past_counts(groups: List[Group]) -> JSONData:
    offset = 0
    all_results = []

    while True:
        query = _generate_query(groups, offset)
        request = Request(dataset="events", app_id="sentry.issues.escalating", query=query)
        results = raw_snql_query(request, referrer="sentry.issues.escalating")["data"]
        if not results:
            break
        else:
            all_results += results
            offset += QUERY_LIMIT

    return all_results


def _generate_query(groups: List[Group], offset: int) -> Query:
    project_ids, group_ids = _extract_project_and_group_ids(groups)
    group_id_col = Column("group_id")
    proj_id_col = Column("project_id")
    start_date, end_date = _start_and_end_dates()
    return Query(
        match=Entity("events"),
        select=[
            proj_id_col,
            group_id_col,
            Function("toStartOfHour", [Column("timestamp")], "hourBucket"),
            Function("count", []),
        ],
        groupby=[proj_id_col, group_id_col, Column("hourBucket")],
        where=[
            Condition(proj_id_col, Op.IN, Function("tuple", project_ids)),
            Condition(Column("group_id"), Op.IN, Function("tuple", group_ids)),
            Condition(Column("timestamp"), Op.GTE, start_date),
            Condition(Column("timestamp"), Op.LT, end_date),
        ],
        limit=Limit(QUERY_LIMIT),
        offset=Offset(offset),
        orderby=[
            # Make sure all the groups related to same project are returned first
            # IIUC this will help Snuba with performance
            OrderBy(proj_id_col, Direction.ASC),
            OrderBy(group_id_col, Direction.ASC),
            OrderBy(Column("hourBucket"), Direction.ASC),
        ],
    )


# XXX: Add unit tests
def _start_and_end_dates(hours: int = 168) -> Tuple[datetime, datetime]:
    """Return start and end date based on the last hour.
    This will ensure that when we query Snuba we will have N buckets of an hour
    without missing any minutes of it."""
    datetime_to_minute_zero = datetime.now().replace(minute=0, second=0, microsecond=0)
    return datetime_to_minute_zero - timedelta(hours=hours), datetime_to_minute_zero


def _extract_project_and_group_ids(groups: List[Group]) -> Tuple[List[int], List[int]]:
    """Return all project and group IDs from a list of Group"""
    group_ids = []
    project_ids = []
    for group in groups:
        project_ids.append(group.project_id)
        group_ids.append(group.id)

    # This also removes duplicated project ids
    return list(set(project_ids)), group_ids
