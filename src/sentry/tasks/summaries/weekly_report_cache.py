from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import json, metrics, redis
from sentry.utils.dates import floor_to_utc_day, to_datetime

CACHE_TTL = timedelta(days=14)
KEY_PREFIX = "wr:proj_metrics"
SATURDAY_ISOWEEKDAY = 6


def _floor_to_saturday(timestamp: float) -> float:
    """Normalize a timestamp to the most recent Saturday at UTC midnight."""
    dt = floor_to_utc_day(to_datetime(timestamp))
    days_since_saturday = (dt.isoweekday() - SATURDAY_ISOWEEKDAY) % 7
    return (dt - timedelta(days=days_since_saturday)).timestamp()


def _make_cache_key(org_id: int, project_id: int, timestamp: float) -> str:
    return f"{KEY_PREFIX}:{org_id}:{project_id}:{timestamp}"


def _get_redis_client() -> RedisCluster[str] | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_WEEKLY_REPORTS_REDIS_CLUSTER)


def cache_project_metrics(
    org_id: int,
    timestamp: float,
    project_metrics: dict[int, dict[str, int]],
) -> None:
    """
    Cache per-project weekly report metrics in Redis.

    project_metrics maps project_id -> {"e": <total_errors>, "t": <total_transactions>}
    """
    if not project_metrics:
        return

    timestamp = _floor_to_saturday(timestamp)
    client = _get_redis_client()
    pipeline = client.pipeline()
    ttl_seconds = int(CACHE_TTL.total_seconds())

    for project_id, values in project_metrics.items():
        key = _make_cache_key(org_id, project_id, timestamp)
        pipeline.set(key, json.dumps(values), ex=ttl_seconds)

    pipeline.execute()


def read_project_metrics(
    org_id: int,
    project_ids: list[int],
    current_timestamp: float,
    previous_timestamp: float,
) -> dict[int, dict[str, Any]]:
    """
    Read cached metrics for the current and previous week for each project.

    Returns {project_id: {"current": {...} | None, "previous": {...} | None}}
    """
    if not project_ids:
        return {}

    current_timestamp = _floor_to_saturday(current_timestamp)
    previous_timestamp = _floor_to_saturday(previous_timestamp)
    client = _get_redis_client()
    pipeline = client.pipeline()

    for project_id in project_ids:
        pipeline.get(_make_cache_key(org_id, project_id, current_timestamp))
    for project_id in project_ids:
        pipeline.get(_make_cache_key(org_id, project_id, previous_timestamp))

    results = pipeline.execute()
    n = len(project_ids)

    result_map: dict[int, dict[str, Any]] = {}
    for i, project_id in enumerate(project_ids):
        current_raw = results[i]
        previous_raw = results[n + i]

        current = json.loads(current_raw) if current_raw else None
        previous = json.loads(previous_raw) if previous_raw else None

        if current is None:
            metrics.incr("weekly_report.cache.miss", tags={"week": "current"})
        if previous is None:
            metrics.incr("weekly_report.cache.miss", tags={"week": "previous"})

        if current is not None or previous is not None:
            result_map[project_id] = {
                "current": current,
                "previous": previous,
            }

    return result_map
