from __future__ import annotations

import logging
from collections.abc import Iterable
from datetime import timedelta

from redis.client import StrictRedis
from rediscluster import RedisCluster

from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)

# Padded past 3 days so nightly-run jitter can't expire a key right at the
# 3-day boundary; guarantees the next 3 nightly runs suppress the issue.
SKIP_TTL_SECONDS = int(timedelta(days=3, hours=12).total_seconds())
KEY_PREFIX = "seer:night-shift:skip:"


def mark_skipped(group_id: int) -> None:
    try:
        _client().set(key(group_id), "1", ex=SKIP_TTL_SECONDS)
    except Exception:
        logger.exception(
            "seer.night_shift.skip_cache.mark_skipped_failed",
            extra={"group_id": group_id},
        )


def recently_skipped(group_ids: Iterable[int]) -> set[int]:
    ids = list(group_ids)
    if not ids:
        return set()

    try:
        pipeline = _client().pipeline()
        for gid in ids:
            pipeline.get(key(gid))
        values = pipeline.execute()
    except Exception:
        logger.exception("seer.night_shift.skip_cache.recently_skipped_failed")
        return set()

    return {gid for gid, val in zip(ids, values) if val is not None}


def key(group_id: int) -> str:
    return f"{KEY_PREFIX}{group_id}"


def _client() -> RedisCluster[str] | StrictRedis[str]:
    return redis_clusters.get("default")
