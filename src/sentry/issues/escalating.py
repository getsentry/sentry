from datetime import datetime, timedelta
from typing import List, Tuple

from snuba_sdk import Column, Condition, Entity, Function, Limit, Offset, Op, Query, Request

from sentry.models import Group
from sentry.utils.json import JSONData
from sentry.utils.snuba import raw_snql_query


def extract_project_and_group_ids(groups: List[Group]) -> Tuple[List[int], List[int]]:
    """Return all project and group IDs from a list of Group"""
    group_ids = []
    project_ids = []
    for group in groups:
        project_ids.append(group.project_id)
        group_ids.append(group.id)

    return project_ids, group_ids


def query_groups_past_counts(groups: List[Group]) -> JSONData:
    project_ids, group_ids = extract_project_and_group_ids(groups)

    query = Query(
        match=Entity("events"),
        select=[
            Column("project_id"),
            Column("group_id"),
            Function("toStartOfHour", [Column("timestamp")], "hourBucket"),
        ],
        groupby=[Column("project_id"), Column("group_id"), Column("hourBucket")],
        where=[
            Condition(Column("project_id"), Op.IN, Function("tuple", project_ids)),
            Condition(Column("group_id"), Op.IN, Function("tuple", group_ids)),
            Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=14)),
            Condition(Column("timestamp"), Op.LT, datetime.today()),
        ],
        limit=Limit(1),  # Limit(10000)
        offset=Offset(0),
        # TODO: ORDER BY project_id DESC, group_id DESC, hourBucket DESC
        # orderby=[OrderBy(Column("project_id"), Direction.DESC)]
    )
    request = Request(dataset="events", app_id="sentry.issues.escalating", query=query)
    request.validate()
    data = raw_snql_query(request, referrer="sentry.issues.escalating")
    return data["data"]
