from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.utils import timezone
from redis.client import StrictRedis
from sentry_redis_tools.clients import RedisCluster

from sentry.utils.redis import redis_clusters

# How often the frontend should refresh presence
HEARTBEAT_INTERVAL = timedelta(seconds=5)
# How long we retain presence after the last heartbeat
PRESENCE_WINDOW = HEARTBEAT_INTERVAL * 4
KEY_PREFIX = "investigations:presence:"


@dataclass(frozen=True)
class Heartbeat:
    # False on the first heartbeat of a visit, or after the viewer's entry expired.
    was_present: bool
    # Active viewers, most recent heartbeat first. Includes the caller.
    viewer_ids: list[int]


def record_heartbeat(investigation_id: int, user_id: int, now: datetime | None = None) -> Heartbeat:
    """Mark `user_id` as viewing the investigation and return who else is viewing it."""
    now_ts = (now or timezone.now()).timestamp()
    cutoff = now_ts - PRESENCE_WINDOW.total_seconds()
    key = _key(investigation_id)

    # A sorted set of user id -> last heartbeat time. Read the caller's previous time
    # (new visit if missing or stale), update it, prune members older than the window,
    # and list who is left. The TTL removes the key once everyone has left.
    pipeline = _client().pipeline(transaction=False)
    pipeline.zscore(key, user_id)
    pipeline.zadd(key, {str(user_id): now_ts})
    pipeline.zremrangebyscore(key, "-inf", f"({cutoff}")
    pipeline.zrevrange(key, 0, -1)
    pipeline.expire(key, int(PRESENCE_WINDOW.total_seconds()))
    previous, _, _, members, _ = pipeline.execute()

    return Heartbeat(
        was_present=previous is not None and float(previous) >= cutoff,
        viewer_ids=[int(member) for member in members],
    )


def _key(investigation_id: int) -> str:
    return f"{KEY_PREFIX}{investigation_id}"


def _client() -> RedisCluster[str] | StrictRedis[str]:
    return redis_clusters.get("default")
