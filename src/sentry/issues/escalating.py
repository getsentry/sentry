from datetime import datetime, timedelta
from typing import Dict, List, Tuple, TypedDict

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

from sentry.issues.escalating_issues_alg import GroupCount
from sentry.models import Group
from sentry.utils.snuba import raw_snql_query

QUERY_LIMIT = 10000  # This is the maximum value for Snuba
# The amount of data needed to generate a group forecast
SEVEN_DAYS_IN_HOURS = 7 * 24

GroupsCountResponse = TypedDict(
    "GroupsCountResponse",
    {"group_id": int, "hourBucket": str, "count()": int},
)

ParsedGroupsCount = Dict[int, GroupCount]


def query_groups_past_counts(groups: List[Group]) -> List[GroupsCountResponse]:
    """Query Snuba for the counts for every group bucketed into hours"""
    offset = 0
    all_results = []
    start_date, end_date = _start_and_end_dates()
    project_ids, group_ids = _extract_project_and_group_ids(groups)

    while True:
        query = _generate_query(group_ids, project_ids, offset, start_date, end_date)
        request = Request(dataset="events", app_id="sentry.issues.escalating", query=query)
        results = raw_snql_query(request, referrer="sentry.issues.escalating")["data"]
        if not results:
            break
        else:
            all_results += results
            offset += QUERY_LIMIT

    return all_results


def parse_groups_past_counts(response: List[GroupsCountResponse]) -> ParsedGroupsCount:
    """
    Return the parsed snuba response for groups past counts to be used in generate_issue_forecast.
    ParsedGroupCount is of the form {<group_id>: {"intervals": [str], "data": [int]}}.

    `response`: Snuba response for group event counts
    """
    group_counts: ParsedGroupsCount = {}
    group_ids_list = group_counts.keys()
    for data in response:
        group_id = data["group_id"]
        if group_id not in group_ids_list:
            group_counts[group_id] = {
                "intervals": [data["hourBucket"]],
                "data": [data["count()"]],
            }
        else:
            group_counts[group_id]["intervals"].append(data["hourBucket"])
            group_counts[group_id]["data"].append(data["count()"])
    return group_counts


def _generate_query(
    group_ids: List[int],
    project_ids: List[int],
    offset: int,
    start_date: datetime,
    end_date: datetime,
) -> Query:
    """This simply generates a query based on the passed parameters"""
    group_id_col = Column("group_id")
    proj_id_col = Column("project_id")
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
            OrderBy(proj_id_col, Direction.ASC),
            OrderBy(group_id_col, Direction.ASC),
            OrderBy(Column("hourBucket"), Direction.ASC),
        ],
    )


def _start_and_end_dates(hours: int = SEVEN_DAYS_IN_HOURS) -> Tuple[datetime, datetime]:
    """Return the start and end date of N hours time range."""
    end_datetime = datetime.now()
    return end_datetime - timedelta(hours=hours), end_datetime


def _extract_project_and_group_ids(groups: List[Group]) -> Tuple[List[int], List[int]]:
    """Return all project and group IDs from a list of Group"""
    group_ids = []
    project_ids = []
    for group in groups:
        project_ids.append(group.project_id)
        group_ids.append(group.id)

    # This also removes duplicated project ids
    return list(set(project_ids)), group_ids
