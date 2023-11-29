"""This module has the logic for calculating the velocity threshold based on the 90th percentile
of events per issue per hour, which is then stored per project in Redis.
"""

import logging
import math
from datetime import datetime, timedelta
from typing import Optional

import sentry_sdk
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.models.project import Project
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.redis import redis_clusters
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

REFERRER = "sentry.issues.issue_velocity"
CLUSTER_KEY = ""
WEEK_IN_HOURS = 7 * 24


def calculate_velocity_threshold_for_project(project: Project) -> Optional[float]:
    now = datetime.now()
    one_week_ago = now - timedelta(days=7)
    ninety_days_ago = now - timedelta(days=90)

    subquery = Query(
        match=Entity(EntityKey.IssuePlatform.value),
        select=[
            Column("group_id"),
            Function("min", [Column("timestamp")], "first_seen"),  # when the issue was first seen
            Function(
                "countIf",
                [
                    Function("greaterOrEquals", [Column("timestamp"), one_week_ago])
                ],  # count events for the issue that occurred within the past week
                "past_week_event_count",
            ),
            Function(
                "if",
                [
                    Function(
                        "less", [Column("first_seen"), one_week_ago]
                    ),  # if the issue is older than a week
                    Function(
                        "divide", [Column("past_week_event_count"), WEEK_IN_HOURS]
                    ),  # divide the number of events in the week by a week in hours
                    Function(
                        "divide",
                        [
                            Column("past_week_event_count"),
                            Function(
                                "dateDiff", ["hour", Column("first_seen"), now]
                            ),  # otherwise divide by its age in hours
                        ],
                    ),
                ],
                "hourly_event_rate",
            ),
        ],
        groupby=[Column("group_id")],
        where=[
            Condition(
                Column("timestamp"), Op.GTE, ninety_days_ago
            ),  # include issues up to the oldest retention date to determine whether an issue is older than the week or not
            Condition(Column("timestamp"), Op.LT, now),
            Condition(Column("project_id"), Op.EQ, project.id),
        ],
        having=[
            Condition(Column("past_week_event_count"), Op.GT, 1)
        ],  # exclude any issues that had only 1 event in the past week
        orderby=[OrderBy(Column("first_seen"), Direction.ASC)],
        limit=Limit(10000),
    )

    query = Query(
        match=subquery,
        select=[
            Function("quantile(0.9)", [Column("hourly_event_rate")], "p90")
        ],  # get the approximate 90th percentile of the event frequency in the past week
        limit=Limit(1),
    )

    request = Request(
        dataset=Dataset.IssuePlatform.value,
        app_id=REFERRER,
        query=query,
        tenant_ids={"referrer": REFERRER, "organization_id": project.organization.id},
    )

    result = raw_snql_query(request, referrer=REFERRER)["data"]
    if len(result) == 0:
        return None

    try:
        return result[0]["p90"]
    except KeyError:
        return None


def set_velocity_threshold_for_project(project: Project) -> None:
    threshold = calculate_velocity_threshold_for_project(project)
    if threshold is None:
        logger.error("Velocity threshold couldn't be calculated", extra={"project_id": project.id})
        return
    elif math.isnan(threshold):
        pass  # TODO
    # store in redis
    with sentry_sdk.start_span(op="cluster.{CLUSTER_KEY}.set_velocity_threshold_for_project"):
        client = redis_clusters.get(CLUSTER_KEY)
        client.set(str(project.id), f"{threshold}")


def get_velocity_threshold_for_project(project: Project):
    # get from redis
    client = redis_clusters.get(CLUSTER_KEY)
    return client.get(str(project.id))
