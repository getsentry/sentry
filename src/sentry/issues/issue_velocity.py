"""This module has the logic for calculating the velocity threshold based on the 90th percentile
of events per issue per hour, which is then stored per project in Redis.
"""

import logging
import math
from datetime import datetime, timedelta
from typing import Optional

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
from sentry.utils import json
from sentry.utils.redis import RedisCluster, redis_clusters
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

# for snuba operations
REFERRER = "sentry.issues.issue_velocity"
THRESHOLD_QUANTILE = {"name": "p90", "function": "quantile(0.9)"}
WEEK_IN_HOURS = 7 * 24

# for redis operations
REDIS_TTL = 24 * 60 * 60  # 1 day
PROJECT_KEY = "new-issue-escalation-threshold:{project_id}"


def calculate_velocity_threshold_for_project(project: Project) -> Optional[float]:
    """
    Calculates the velocity threshold based on event frequency in the project for the past week.
    """
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
            Function(
                THRESHOLD_QUANTILE["function"],
                [Column("hourly_event_rate")],
                THRESHOLD_QUANTILE["name"],
            )
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
        return result[0][THRESHOLD_QUANTILE["name"]]
    except KeyError:
        logger.exception(
            "Unexpected shape for threshold query results",
            extra={"project_id": project.id, "results_received": json.dumps(result)},
        )
        return None


def set_velocity_threshold_for_project(project: Project) -> float:
    """
    Set the threshold in Redis, setting as -1 when no threshold is calculated.
    """
    threshold = calculate_velocity_threshold_for_project(project)
    if threshold is None:
        logger.error(
            "Velocity threshold couldn't be calculated, error with query",
            extra={"project_id": project.id},
        )
        threshold = -1
    elif math.isnan(threshold):  # indicates there were no valid events to base the calculation
        threshold = -1

    client = get_redis_client()
    client.set(PROJECT_KEY.format(project_id=project.id), {"threshold": threshold}, ex=REDIS_TTL)

    return threshold


def get_velocity_threshold_for_project(project: Project):
    """
    Returns the threshold from Redis if it can be found, otherwise re-calculates.
    """
    # get from redis
    client = get_redis_client()
    key = PROJECT_KEY.format(project_id=project.id)
    result = client.get(key)
    if not result:  # expired or doesn't exist
        result = set_velocity_threshold_for_project
    return result


def get_redis_client() -> RedisCluster:
    cluster_key = ""  # TODO: placeholder
    return redis_clusters.get(cluster_key)
