"""This module has the logic for calculating the velocity threshold based on the 90th percentile
of events per issue per hour, which is then stored per project in Redis.
"""

import datetime
import logging

from snuba_sdk import (  # Limit,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.models.project import Project
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

REFERRER = "sentry.issues.issue_velocity"


def calculate_velocity_threshold_for_project(project: Project) -> int | None:
    """
    what am i querying for

    within a project (x), i need the 90th percentile of the number
    of events per issue per hour for each issue (x) that had an
    event within the last week (x)
    """
    now = datetime.now()
    one_week_ago = now - datetime.timedelta(days=7)
    # query = Query(
    #     match=Entity(EntityKey.Events.value),
    #     select=[
    #         Column("group_id"),  # for each issue
    #         Function("quantile(0.9)", [Function("division (per hour)", parameters=[Function("division (per issue)", parameters=[Function("sum", Column(""))])])], "p90"),
    #     ],
    #     where=[
    #         Condition(Column("timestamp"), Op.LT, now),
    #         Condition(Column("timestamp"), Op.GTE, one_week_ago),
    #         Condition(Column("project_id"), Op.EQ, project.id),
    #     ],
    #     groupby=[Column("group_id")],
    #     having=[
    #         Condition(
    #             Function("count", [], "event_count"), Op.GT, 1
    #         )  # only issues that had an event in the last week
    #     ],
    #     limit=Limit(1),
    # )

    # the below query gets the hourly counts for a project
    query = Query(
        match=Entity(EntityKey.Events.value),
        select=[Column("time"), Column("group_id"), Function("count", [], "event_count")],
        where=[
            Condition(Column("timestamp"), Op.LT, now),
            Condition(Column("timestamp"), Op.GTE, one_week_ago),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        having=[Condition(Column("event_count"), Op.GT, 1)],
        groupby=[Column("time"), Column("group_id")],
        orderby=[OrderBy(Column("time"), Direction.ASC)],
        granularity=Granularity(3600),
    )

    request = Request(
        dataset=Dataset.Events,
        app_id=REFERRER,
        query=query,
        tenant_ids={"referrer": REFERRER, "organization_id": project.organization.id},
    )

    result = raw_snql_query(request, referrer=REFERRER)["data"]
    if len(result) == 0:
        return None

    return result


def set_velocity_threshold_for_project(project: Project) -> None:
    threshold = calculate_velocity_threshold_for_project(project)
    if threshold is None:
        logger.error("Velocity threshold couldn't be calculated", extra={"project_id": project.id})
        return
    # store in redis


def get_velocity_threshold_for_project(project: Project) -> int:
    # get from redis
    pass
