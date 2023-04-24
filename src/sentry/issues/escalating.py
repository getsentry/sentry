"""This module has the logic for querying Snuba for the hourly event count for a list of groups.
This is later used for generating group forecasts for determining when a group may be escalating.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Sequence, Tuple, TypedDict

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
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.snuba import raw_snql_query

__all__ = ["query_groups_past_counts", "parse_groups_past_counts"]

REFERRER = "sentry.issues.escalating"
ELEMENTS_PER_SNUBA_PAGE = 10000  # This is the maximum value for Snuba
# The amount of data needed to generate a group forecast
BUCKETS_PER_GROUP = 7 * 24

GroupsCountResponse = TypedDict(
    "GroupsCountResponse",
    {"group_id": int, "hourBucket": str, "count()": int, "project_id": int},
)

ParsedGroupsCount = Dict[int, GroupCount]


def query_groups_past_counts(groups: Sequence[Group]) -> List[GroupsCountResponse]:
    """Query Snuba for the counts for every group bucketed into hours"""
    start_date, end_date = _start_and_end_dates()
    project_ids, group_ids = _extract_project_and_group_ids(groups)
    return _query_with_pagination(project_ids, group_ids, start_date, end_date)


def _query_with_pagination(
    project_ids: Sequence[int], group_ids: Sequence[int], start_date: datetime, end_date: datetime
) -> List[GroupsCountResponse]:
    """Query Snuba for event counts for the given list of project ids and groups ids in
    a time range."""
    all_results = []
    offset = 0
    while True:
        query = _generate_query(project_ids, group_ids, offset, start_date, end_date)
        request = Request(dataset=Dataset.Events.value, app_id=REFERRER, query=query)
        results = raw_snql_query(request, referrer=REFERRER)["data"]
        all_results += results
        offset += ELEMENTS_PER_SNUBA_PAGE
        if not results or len(results) < ELEMENTS_PER_SNUBA_PAGE:
            break

    return all_results


def parse_groups_past_counts(response: Sequence[GroupsCountResponse]) -> ParsedGroupsCount:
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
    project_ids: Sequence[int],
    group_ids: Sequence[int],
    offset: int,
    start_date: datetime,
    end_date: datetime,
) -> Query:
    """This simply generates a query based on the passed parameters"""
    group_id_col = Column("group_id")
    proj_id_col = Column("project_id")
    return Query(
        match=Entity(EntityKey.Events.value),
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
        limit=Limit(ELEMENTS_PER_SNUBA_PAGE),
        offset=Offset(offset),
        orderby=[
            OrderBy(proj_id_col, Direction.ASC),
            OrderBy(group_id_col, Direction.ASC),
            OrderBy(Column("hourBucket"), Direction.ASC),
        ],
    )


def _start_and_end_dates(hours: int = BUCKETS_PER_GROUP) -> Tuple[datetime, datetime]:
    """Return the start and end date of N hours time range."""
    end_datetime = datetime.now()
    return end_datetime - timedelta(hours=hours), end_datetime


def _extract_project_and_group_ids(groups: Sequence[Group]) -> Tuple[List[int], List[int]]:
    """Return all project and group IDs from a list of Group"""
    group_ids = []
    project_ids = []
    for group in groups:
        project_ids.append(group.project_id)
        group_ids.append(group.id)

    # This also removes duplicated project ids
    return list(set(project_ids)), group_ids
