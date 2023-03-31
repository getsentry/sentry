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


def extract_project_and_group_ids(groups: List[Group]) -> Tuple[List[int], List[int]]:
    """Return all project and group IDs from a list of Group"""
    group_ids = []
    project_ids = []
    for group in groups:
        project_ids.append(group.project_id)
        group_ids.append(group.id)

    # This also removes duplicated project ids
    return list(set(project_ids)), group_ids


def query_groups_past_counts(groups: List[Group]) -> JSONData:
    project_ids, group_ids = extract_project_and_group_ids(groups)
    group_id_col = Column("group_id")
    proj_id_col = Column("project_id")

    query = Query(
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
            Condition(Column("timestamp"), Op.GTE, datetime.now() - timedelta(days=14)),
            Condition(Column("timestamp"), Op.LT, datetime.today()),
        ],
        limit=Limit(10),  # TODO: Limit(10000)
        offset=Offset(0),
        orderby=[
            # Make sure all the groups related to same project are returned first
            # IIUC this will help Snuba with performance
            OrderBy(proj_id_col, Direction.ASC),
            OrderBy(group_id_col, Direction.ASC),
            OrderBy(Column("hourBucket"), Direction.ASC),
        ],
    )
    request = Request(dataset="events", app_id="sentry.issues.escalating", query=query)
    request.validate()
    data = raw_snql_query(request, referrer="sentry.issues.escalating")
    return data["data"]
