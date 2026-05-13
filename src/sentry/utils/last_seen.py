from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.core.cache import cache
from django.db.utils import OperationalError


def try_bump_last_seen(
    *,
    model_class: Any,
    instance: Any,
    datetime: datetime,
    bump_key: str,
    cache_key: str,
    metrics_tags: dict[str, str],
) -> bool:
    """Throttled last_seen bump — at most once per 60s per row via a cache-based lock."""
    if instance.last_seen >= datetime - timedelta(seconds=60):
        metrics_tags["bumped"] = "false"
        return False

    if not cache.add(bump_key, "1", timeout=60):
        metrics_tags["bumped"] = "skipped"
        return False

    try:
        model_class.objects.filter(id=instance.id, last_seen__lt=datetime).update(
            last_seen=datetime
        )
    except OperationalError:
        metrics_tags["bumped"] = "error"
        return False

    instance.last_seen = datetime
    cache.set(cache_key, instance, 3600)
    metrics_tags["bumped"] = "true"
    return True
