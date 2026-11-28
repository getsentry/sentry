from __future__ import annotations

import threading

from cachetools import TTLCache
from django.core.cache import cache

from sentry.utils.hashlib import md5_text

MISSING_MONITOR_TTL = 3600

# Keys this process marked. The shared marker is only read for these, so
# check-ins for monitors that exist never touch the cache.
_marked_here: TTLCache[str, bool] = TTLCache(maxsize=10_000, ttl=MISSING_MONITOR_TTL)
_marked_here_lock = threading.Lock()


def _missing_monitor_key(project_id: int, slug: str) -> str:
    return f"monitors:missing:{project_id}:{md5_text(slug).hexdigest()}"


def mark_monitor_missing(project_id: int, slug: str) -> None:
    key = _missing_monitor_key(project_id, slug)
    cache.set(key, True, MISSING_MONITOR_TTL)
    with _marked_here_lock:
        _marked_here[key] = True


def is_monitor_marked_missing(project_id: int, slug: str) -> bool:
    key = _missing_monitor_key(project_id, slug)
    with _marked_here_lock:
        if key not in _marked_here:
            return False
    if cache.get(key):
        return True
    with _marked_here_lock:
        _marked_here.pop(key, None)
    return False


def clear_monitor_missing(project_id: int, slug: str) -> None:
    cache.delete(_missing_monitor_key(project_id, slug))
