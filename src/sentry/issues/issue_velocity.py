"""This module contains the logic for calculating the velocity threshold based on the 90th percentile
of events per issue per hour, and getting it from and saving it to Redis.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Optional

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis
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

from sentry.snuba.dataset import Dataset, EntityKey
from sentry.tasks.post_process import locks
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.redis import redis_clusters

if TYPE_CHECKING:
    from sentry.models.project import Project


logger = logging.getLogger(__name__)

# for snuba operations
REFERRER = "sentry.issues.issue_velocity"
THRESHOLD_QUANTILE = {"name": "p99", "function": "quantile(0.99)"}
WEEK_IN_HOURS = 7 * 24

# for redis operations
DEFAULT_TTL = 48 * 60 * 60  # 2 days
FALLBACK_TTL = 10 * 60  # 10 minutes; TTL for storing temporary values while we can't query Snuba
THRESHOLD_KEY = "new-issue-escalation-threshold:{project_id}"
STALE_DATE_KEY = "new-issue-escalation-threshold-stale-date:v2:{project_id}"
LEGACY_STALE_DATE_KEY = "new-issue-escalation-threshold-stale-date:{project_id}"
STRING_TO_DATETIME = "%Y-%m-%d %H:%M:%S.%f"
LEGACY_STRING_TO_DATETIME = "%Y%m%d"
TIME_TO_USE_EXISTING_THRESHOLD = 24 * 60 * 60  # 1 day


def calculate_threshold(project: Project) -> Optional[float]:
    """
    Calculates the velocity threshold based on event frequency in the project for the past week.
    """
    from sentry.utils.snuba import raw_snql_query

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

    try:
        result = raw_snql_query(request, referrer=REFERRER)["data"]
    except Exception:
        logger.exception(
            "sentry.issues.issue_velocity.calculate_threshold.error",
            extra={"project_id": project.id},
        )
        return None

    return result[0][THRESHOLD_QUANTILE["name"]]


def update_threshold(
    project: Project,
    threshold_key: str,
    stale_date_key: str,
    stale_threshold: Optional[float] = None,
) -> float:
    """
    Runs the calculation for the threshold and saves it and the date it is last updated to Redis.
    If the threshold is NaN, we save it as 0 at the normal TTL. If the threshold is `None` (due to
    Snuba errors), we call the fallback method.
    """
    threshold = calculate_threshold(project)
    if threshold is None:
        return fallback_to_stale_or_zero(threshold_key, stale_date_key, stale_threshold)
    if math.isnan(threshold):
        threshold = 0

    ttl = DEFAULT_TTL
    client = get_redis_client()
    with client.pipeline() as p:
        p.set(threshold_key, threshold, ex=ttl)
        p.set(stale_date_key, str(datetime.utcnow()), ex=ttl)
        p.execute()
    metrics.incr("issues.update_new_escalation_threshold", tags={"useFallback": False})
    return threshold


def fallback_to_stale_or_zero(
    threshold_key: str, stale_date_key: str, stale_threshold: Optional[float]
) -> float:
    """
    Returns the backup threshold for when the current threshold can't be calculated. If we have a
    stale threshold, its stale date in Redis is extended to make it usable for the next ten minutes,
    while TTL is maintained. Otherwise, we save a value of 0 with a stale date and TTL of ten minutes
    into the future, and return 0 (so issues in this project do not escalate during this time).
    """
    ttl = FALLBACK_TTL
    # current datetime - the amount of time a threshold is valid for + how much time to wait before trying to query Snuba for the threshold again
    stale_date = (
        datetime.utcnow()
        - timedelta(seconds=TIME_TO_USE_EXISTING_THRESHOLD)
        + timedelta(seconds=FALLBACK_TTL)
    )
    client = get_redis_client()
    with client.pipeline() as p:
        p.watch(threshold_key)
        existing_ttl = p.ttl(threshold_key)  # get the ttl of the stale threshold
        if stale_threshold is not None and isinstance(existing_ttl, int) and existing_ttl > 0:
            ttl = existing_ttl
        else:
            # if the stale threshold doesn't exist, doesn't have an expiry, or is exactly expired
            # in redis, don't use it; fallback to zero
            stale_threshold = 0
        p.multi()

        if stale_threshold == 0:
            p.set(threshold_key, stale_threshold, ex=ttl)
        p.set(stale_date_key, str(stale_date), ex=ttl)
        p.execute()
    metrics.incr("issues.update_new_escalation_threshold", tags={"useFallback": True})
    return stale_threshold


def get_latest_threshold(project: Project) -> float:
    """
    Returns the most up-to-date threshold for the project, re-calculating if outdated or non-existent.
    If the lock cannot be acquired, another process is updating, so we return the stale value.
    """
    keys = [
        THRESHOLD_KEY.format(project_id=project.id),
        STALE_DATE_KEY.format(project_id=project.id),
        LEGACY_STALE_DATE_KEY.format(project_id=project.id),
    ]
    client = get_redis_client()
    cache_results = client.mget(keys)  # returns None if key is nonexistent
    threshold = cache_results[0]
    stale_date = None
    if cache_results[1] is not None:
        stale_date = datetime.strptime(cache_results[1], STRING_TO_DATETIME)
    elif cache_results[2] is not None:  # for backwards compatibility
        # TODO(isabella): remove the legacy format once it is no longer being used
        stale_date = datetime.strptime(cache_results[2], LEGACY_STRING_TO_DATETIME)
        logger.info(
            "issue_velocity.get_latest_threshold.legacy_date_format",
            extra={"org_id": project.organization.id, "project_id": project.id},
        )
    now = datetime.utcnow()
    if (
        stale_date is None
        or threshold is None
        or (now - stale_date).total_seconds() > TIME_TO_USE_EXISTING_THRESHOLD
    ):
        lock = locks.get(
            f"calculate_project_thresholds:{project.id}",
            duration=10,
            name="calculate_project_thresholds",
        )
        try:
            with lock.acquire():
                threshold = update_threshold(project, keys[0], keys[1], threshold)
        except UnableToAcquireLock:  # another process is already updating
            logger.warning(
                "issue_velocity.get_latest_threshold.unable_to_acquire_lock",
                exc_info=True,
                extra={"org_id": project.organization.id, "project_id": project.id},
            )
            threshold = float(threshold) if threshold else 0  # use stale value if possible
    else:
        # redis stores as strings, so convert back to a float if using the value from the cache
        threshold = float(threshold)
    return threshold


def get_redis_client() -> RedisCluster | StrictRedis:
    return redis_clusters.get(settings.SENTRY_ESCALATION_THRESHOLDS_REDIS_CLUSTER)
