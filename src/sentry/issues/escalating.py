from datetime import datetime, timedelta
from typing import List, Tuple, TypedDict

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
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.snuba import raw_snql_query

REFERRER = "sentry.issues.escalating"
QUERY_LIMIT = 10000  # This is the maximum value for Snuba
# The amount of data needed to generate a group forecast
BUCKETS_PER_GROUP = 7 * 24

GroupsCountResponse = TypedDict(
    "GroupsCountResponse",
    {"group_id": int, "hourBucket": str, "count()": int},
)


def query_groups_past_counts(groups: List[Group]) -> List[GroupsCountResponse]:
    """Query Snuba for the counts for every group bucketed into hours.

    It optimizes the query by guaranteeing that we look at group_ids that are from the same project id.
    This is important for Snuba as the data is stored in blocks related to the project id"""
    offset = 0
    all_results = []
    start_date, end_date = _start_and_end_dates()
    group_ids_by_project = _extract_project_and_group_ids(groups)
    proj_ids, group_ids = [], []

    for proj_id in group_ids_by_project.keys():
        _group_ids = group_ids_by_project[proj_id]
        proj_ids.append(proj_id)
        group_ids.append(_group_ids)
        # Maximize the number of projects and groups to reduce total number of Snuba queries
        # Each group can have a maximum of BUCKETS_PER_GROUP buckets, thus, projects with
        # few groups should be grouped together until we get at least a certain number of groups
        # NOTE: Groups with less than the maximum number of buckets will skew this optimization since
        # we may only get one page and less elements than QUERY_LIMIT (it's fine)
        if len(_group_ids) < QUERY_LIMIT / BUCKETS_PER_GROUP:
            continue

        query = _generate_query(proj_ids, group_ids, offset, start_date, end_date)
        request = Request(dataset=Dataset.Events, app_id=REFERRER, query=query)
        # XXX: We could track a datadog metric when we're not in the last page yet we get less than
        # QUERY_LIMIT elements in the response
        results = raw_snql_query(request, referrer=REFERRER)["data"]
        if not results:
            break
        else:
            all_results += results
            offset += QUERY_LIMIT
            # We're ready for another set of projects and ids
            proj_ids, group_ids = [], []

    return all_results


def _generate_query(
    project_ids: List[int],
    group_ids: List[int],
    offset: int,
    start_date: datetime,
    end_date: datetime,
) -> Query:
    """This simply generates a query based on the passed parameters"""
    group_id_col = Column("group_id")
    proj_id_col = Column("project_id")
    return Query(
        match=Entity(EntityKey.Events),
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


def _start_and_end_dates(hours: int = BUCKETS_PER_GROUP) -> Tuple[datetime, datetime]:
    """Return the start and end date of N hours time range."""
    end_datetime = datetime.now()
    return end_datetime - timedelta(hours=hours), end_datetime


def _extract_project_and_group_ids(groups: List[Group]) -> Tuple[List[int], List[int]]:
    """Return all project and group IDs from a list of Group"""
    group_ids_by_project = {}
    for group in groups:
        if not group_ids_by_project.get(group.project_id):
            group_ids_by_project[group.project_id] = []

        group_ids_by_project[group.project_id].append(group.id)

    return group_ids_by_project
