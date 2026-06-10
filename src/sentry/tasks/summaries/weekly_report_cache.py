from __future__ import annotations

from typing import Any

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import json, metrics, redis

CACHE_TTL_SEC = 10 * 24 * 60 * 60  # 10 days
KEY_PREFIX = "wr:proj_metrics"


def _make_cache_key(org_id: int, project_id: int) -> str:
    return f"{KEY_PREFIX}:{org_id}:{project_id}"


def _get_redis_client() -> RedisCluster[str] | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_WEEKLY_REPORTS_REDIS_CLUSTER)


def cache_project_metrics(
    org_id: int,
    project_metrics: dict[int, dict[str, int]],
) -> None:
    client = _get_redis_client()
    pipeline = client.pipeline()

    for project_id, values in project_metrics.items():
        key = _make_cache_key(org_id, project_id)
        pipeline.set(key, json.dumps(values), ex=CACHE_TTL_SEC)

    pipeline.execute()


def read_project_metrics(
    org_id: int,
    project_ids: list[int],
) -> dict[int, dict[str, Any]]:
    if not project_ids:
        return {}

    client = _get_redis_client()
    pipeline = client.pipeline()

    for project_id in project_ids:
        pipeline.get(_make_cache_key(org_id, project_id))

    results = pipeline.execute()

    result_map: dict[int, dict[str, Any]] = {}
    for i, project_id in enumerate(project_ids):
        raw = results[i]
        if raw is None:
            metrics.incr("weekly_report.cache.miss")
        else:
            result_map[project_id] = json.loads(raw)

    return result_map
