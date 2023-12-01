"""This module contains the logic for calculating the velocity threshold based on the 90th percentile
of events per issue per hour, and getting it from and saving it to Redis.
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

from sentry.locks import locks
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils import json
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.redis import redis_clusters
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

# for snuba operations
REFERRER = "sentry.issues.issue_velocity"
THRESHOLD_QUANTILE = {"name": "p90", "function": "quantile(0.9)"}
WEEK_IN_HOURS = 7 * 24

# for redis operations
REDIS_TTL = 24 * 60 * 60  # 1 day
THRESHOLD_KEY = "new-issue-escalation-threshold:{project_id}"
STALE_DATE_KEY = "new-issue-escalation-threshold-stale-date:{project_id}"


def calculate_threshold(project: Project) -> Optional[float]:
    """
    Calculates the velocity threshold based on event frequency in the project for the past week.
    """
    now = datetime.now()
    one_hour_ago = now - timedelta(hours=1)
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
            Condition(
                Column("past_week_event_count"), Op.GT, 1
            ),  # exclude any issues that had only 1 event in the past week
            Condition(
                Column("first_seen"), Op.LT, one_hour_ago
            ),  # if it's first seen within the last hour, discard to avoid ZeroDivision
        ],
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


def update_threshold(project: Project, threshold_key: str, stale_date_key: str) -> Optional[float]:
    """
    Runs the calculation for the threshold and saves it and the date it is last updated to Redis.
    If no threshold could be calculated for whatever reason, we don't save anything to Redis.
    """
    threshold = calculate_threshold(project)
    if threshold is None:
        logger.error(
            "Velocity threshold couldn't be calculated, query returned nothing",
            extra={"project_id": project.id},
        )
        return None
    elif math.isnan(threshold):  # indicates there were no valid events to base the calculation
        return None

    client = get_redis_client()
    with client.pipeline() as p:
        p.set(threshold_key, threshold, ex=REDIS_TTL)
        p.set(stale_date_key, datetime.utcnow().timestamp(), ex=REDIS_TTL),
        p.execute()

    return threshold


def get_latest_threshold(project: Project):
    """
    Returns the most up-to-date threshold for the project, re-calculating if outdated or non-existent.
    If none can be calculated still, returns None.
    """
    keys = [
        THRESHOLD_KEY.format(project_id=project.id),
        STALE_DATE_KEY.format(project_id=project.id),
    ]
    client = get_redis_client()
    cache_results = client.mget(
        keys
    )  # returns nil in place of result if key doesn't return anything
    threshold, stale_date = cache_results[0], cache_results[1]
    now_timestamp = datetime.utcnow().timestamp()
    if (stale_date and stale_date < now_timestamp) or stale_date is None or threshold is None:
        lock = locks.get(
            f"calculate_project_thresholds:{project.id}",
            duration=10,
            name="calculate_project_thresholds",
        )
        try:
            with lock.acquire():
                threshold = update_threshold(project, keys[0], keys[1])
        except UnableToAcquireLock:  # another process is already updating
            pass
    return threshold


def get_redis_client():
    cluster_key = ""  # TODO: placeholder
    return redis_clusters.get(cluster_key)
