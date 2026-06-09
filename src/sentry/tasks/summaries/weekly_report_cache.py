from __future__ import annotations

from datetime import timedelta
from typing import Any

import sentry_sdk
from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.tasks.summaries.utils import OrganizationReportContext
from sentry.utils import json, metrics, redis

CACHE_TTL = timedelta(days=10)
KEY_PREFIX = "wr:proj_metrics"


def _make_cache_key(org_id: int, project_id: int) -> str:
    return f"{KEY_PREFIX}:{org_id}:{project_id}"


def _get_redis_client() -> RedisCluster[str] | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_WEEKLY_REPORTS_REDIS_CLUSTER)


def cache_project_metrics(ctx: OrganizationReportContext, organization_id: int) -> None:
    project_metrics: dict[int, dict[str, int]] = {}
    for project_id, project_ctx in ctx.projects_context_map.items():
        if not project_ctx.check_if_project_is_empty():
            project_metrics[project_id] = {
                "e": project_ctx.accepted_error_count,
                "t": project_ctx.accepted_transaction_count,
            }

    if not project_metrics:
        return

    with sentry_sdk.start_span(op="weekly_reports.cache_project_metrics"):
        try:
            _write_project_metrics(organization_id, project_metrics)
        except Exception:
            sentry_sdk.capture_exception()


def _write_project_metrics(
    org_id: int,
    project_metrics: dict[int, dict[str, int]],
) -> None:
    client = _get_redis_client()
    pipeline = client.pipeline()
    ttl_seconds = int(CACHE_TTL.total_seconds())

    for project_id, values in project_metrics.items():
        key = _make_cache_key(org_id, project_id)
        pipeline.set(key, json.dumps(values), ex=ttl_seconds)

    pipeline.execute()


def read_project_metrics(
    org_id: int,
    project_ids: list[int],
) -> dict[int, dict[str, Any] | None]:
    if not project_ids:
        return {}

    client = _get_redis_client()
    pipeline = client.pipeline()

    for project_id in project_ids:
        pipeline.get(_make_cache_key(org_id, project_id))

    results = pipeline.execute()

    result_map: dict[int, dict[str, Any] | None] = {}
    for i, project_id in enumerate(project_ids):
        raw = results[i]
        if raw is None:
            metrics.incr("weekly_report.cache.miss")
        else:
            result_map[project_id] = json.loads(raw)

    return result_map
