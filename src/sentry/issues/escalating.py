import datetime
import itertools
from typing import Dict, List

from snuba_sdk import Column, Condition, Entity, Function, Limit, Offset, Op, Query, Request

from sentry.utils.json import JSONData
from sentry.utils.snuba import raw_snql_query


class InvalidProjectsToGroupsMap(Exception):
    pass


def query_groups_past_counts(projects_to_groups: Dict[int, List[int]]) -> JSONData:
    """Single Snuba query to find the total counts per hour per every group in the last 2 weeks."""
    list_of_projects = list(projects_to_groups.keys())
    list_of_groups = list(itertools.chain.from_iterable(projects_to_groups.values()))
    if not (list_of_groups and list_of_projects):
        raise InvalidProjectsToGroupsMap("We expect non-empty lists.")

    query = Query(
        match=Entity("events"),
        select=[
            Column("project_id"),
            Column("group_id"),
            Function("toStartOfHour", [Column("timestamp")], "hourBucket"),
        ],
        groupby=[Column("project_id"), Column("group_id"), Column("hourBucket")],
        where=[
            Condition(Column("project_id"), Op.IN, Function("tuple", list_of_projects)),
            Condition(Column("group_id"), Op.IN, Function("tuple", list_of_groups)),
            Condition(Column("timestamp"), Op.GTE, datetime.datetime(2023, 3, 14)),
            Condition(Column("timestamp"), Op.LT, datetime.datetime(2023, 3, 29)),
        ],
        limit=Limit(1),  # Limit(10000),
        offset=Offset(0),
        # TODO: ORDER BY project_id DESC, group_id DESC, hourBucket DESC
        # orderby=[OrderBy(Column("project_id"), Direction.DESC)]
    )
    request = Request(dataset="events", app_id="sentry.issues.escalating", query=query)
    request.validate()
    data = raw_snql_query(request, referrer="sentry.issues.escalating")
    return data["data"]
