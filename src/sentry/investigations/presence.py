from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from django.utils import timezone
from redis.client import StrictRedis
from sentry_redis_tools.clients import RedisCluster

from sentry.investigations.models import Investigation, InvestigationSeen
from sentry.utils.function_cache import cache_func_for_models
from sentry.utils.redis import redis_clusters

# How often the frontend should refresh presence
HEARTBEAT_INTERVAL = timedelta(seconds=5)
# How long we retain presence after the last heartbeat
PRESENCE_WINDOW = HEARTBEAT_INTERVAL * 4
# How often an ongoing visit refreshes the viewer's "seen" time
SEEN_REFRESH = timedelta(minutes=5)
# How many viewers a heartbeat returns when the caller does not ask for a number
DEFAULT_VIEWER_LIMIT = 20
MAX_VIEWER_LIMIT = 50
# Cached seen rows per investigation, so active viewers can be removed and still leave enough.
SEEN_CACHE_LIMIT = 100
KEY_PREFIX = "investigations:presence:"


@dataclass(frozen=True)
class Heartbeat:
    # False on the first heartbeat of a visit, or after the viewer's entry expired.
    was_present: bool
    # Active viewers and their last heartbeat, most recent first. Includes the caller.
    active: list[tuple[int, datetime]]


@dataclass(frozen=True)
class Viewer:
    user_id: int
    last_seen: datetime
    active: bool


@dataclass(frozen=True)
class Viewers:
    # Active viewers first, then earlier ones, up to the requested limit.
    viewers: list[Viewer]
    # All viewers found, before the limit.
    total: int


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
    pipeline.zrevrange(key, 0, -1, withscores=True)
    pipeline.expire(key, int(PRESENCE_WINDOW.total_seconds()))
    previous, _, _, members, _ = pipeline.execute()

    return Heartbeat(
        was_present=previous is not None and float(previous) >= cutoff,
        active=[(int(member), datetime.fromtimestamp(score, tz=UTC)) for member, score in members],
    )


@cache_func_for_models(
    [(InvestigationSeen, lambda seen: (seen.investigation_id,))],
    cache_ttl=timedelta(hours=1),
)
def seen_by(investigation_id: int) -> list[tuple[int, datetime]]:
    """(user id, last seen) for an investigation, most recent first. Recalculated on every write."""
    return list(
        InvestigationSeen.objects.filter(investigation_id=investigation_id)
        .order_by("-last_seen")
        .values_list("user_id", "last_seen")[:SEEN_CACHE_LIMIT]
    )


def record_visit(
    investigation: Investigation, user_id: int, limit: int = DEFAULT_VIEWER_LIMIT
) -> Viewers:
    """
    Record a heartbeat and list the investigation's other viewers: active ones first, then historical
    """
    now = timezone.now()
    heartbeat = record_heartbeat(investigation.id, user_id, now)
    active_ids = {uid for uid, _ in heartbeat.active}

    seen = seen_by(investigation.id)
    own_last_seen = next((last_seen for uid, last_seen in seen if uid == user_id), None)
    if own_last_seen is None and heartbeat.was_present:
        own_last_seen = (
            InvestigationSeen.objects.filter(investigation=investigation, user_id=user_id)
            .values_list("last_seen", flat=True)
            .first()
        )
    if not heartbeat.was_present or own_last_seen is None or now - own_last_seen >= SEEN_REFRESH:
        InvestigationSeen.objects.update_or_create(
            investigation=investigation, user_id=user_id, defaults={"last_seen": now}
        )

    viewers = [
        Viewer(user_id=uid, last_seen=last_seen, active=True)
        for uid, last_seen in heartbeat.active
        if uid != user_id
    ] + [
        Viewer(user_id=uid, last_seen=last_seen, active=False)
        for uid, last_seen in seen
        if uid not in active_ids
    ]
    return Viewers(viewers=viewers[:limit], total=len(viewers))


def _key(investigation_id: int) -> str:
    return f"{KEY_PREFIX}{investigation_id}"


def _client() -> RedisCluster[str] | StrictRedis[str]:
    return redis_clusters.get("default")
