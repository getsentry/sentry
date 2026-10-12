from __future__ import annotations

from datetime import datetime as dt
from datetime import timedelta
from enum import StrEnum
from typing import Any, Protocol

from django.core.cache import cache
from django.db.utils import OperationalError

LAST_SEEN_INTERVAL_SECONDS = 60


class BumpResult(StrEnum):
    """Outcome of a `try_bump_last_seen` call.

    Propagates if a bumped happened or why it did not happen. Useful to distinguish between
    the three reasons a bump does not happen.
    """

    BUMPED = "bumped"
    THROTTLED = "throttled"
    LOCKED = "locked"
    ERROR = "error"


class HasLastSeen(Protocol):
    id: int
    last_seen: dt


def try_bump_last_seen(
    *,
    model_class: Any,
    instance: HasLastSeen,
    datetime: dt,
    bump_key: str,
    cache_key: str,
    metrics_tags: dict[str, str],
) -> BumpResult:
    """Throttled last_seen bump — at most once per 60s per row via a cache-based lock."""
    if instance.last_seen >= datetime - timedelta(seconds=LAST_SEEN_INTERVAL_SECONDS):
        metrics_tags["bumped"] = "false"
        return BumpResult.THROTTLED

    if not cache.add(bump_key, "1", timeout=60):
        metrics_tags["bumped"] = "skipped"
        return BumpResult.LOCKED

    try:
        model_class.objects.filter(id=instance.id, last_seen__lt=datetime).update(
            last_seen=datetime
        )
    except OperationalError:
        metrics_tags["bumped"] = "error"
        return BumpResult.ERROR

    instance.last_seen = datetime
    cache.set(cache_key, instance, 3600)
    metrics_tags["bumped"] = "true"
    return BumpResult.BUMPED
