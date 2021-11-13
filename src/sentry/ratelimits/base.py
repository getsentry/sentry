from __future__ import annotations

from sentry.utils.services import Service


class RateLimiter(Service):
    __all__ = ("is_limited", "validate", "current_value", "is_limited_with_value")

    window = 60

    def is_limited(self, key: str, limit: int, project=None, window: int | None = None) -> bool:
        is_limited, _ = self.is_limited_with_value(key, limit, project=project, window=window)
        return is_limited

    def current_value(self, key, project=None, window=None):
        return 0

    def is_limited_with_value(self, key, limit, project=None, window=None):
        return False, 0

    def validate(self):
        raise NotImplementedError
