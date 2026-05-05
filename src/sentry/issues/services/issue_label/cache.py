from __future__ import annotations

from typing import Any

from django.core.cache import cache


class IssueLabelCache:
    """
    Caches IssueLabel query results keyed by issue (group) ID.

    Uses Django's cache backend (Redis in production) with a 1-hour TTL.
    """

    TTL = 3600  # 1 hour in seconds
    KEY_PREFIX = "issuelabel:g"

    @classmethod
    def _make_key(cls, group_id: int) -> str:
        return f"{cls.KEY_PREFIX}:{group_id}"

    @classmethod
    def get(cls, group_id: int) -> list[Any] | None:
        """Return cached label list for the given issue, or None on cache miss."""
        return cache.get(cls._make_key(group_id))

    @classmethod
    def set(cls, group_id: int, values: list[Any]) -> None:
        """Store label list in cache for the given issue."""
        cache.set(cls._make_key(group_id), values, cls.TTL)

    @classmethod
    def invalidate(cls, group_id: int) -> None:
        """Remove cached entry for the given issue."""
        cache.delete(cls._make_key(group_id))
