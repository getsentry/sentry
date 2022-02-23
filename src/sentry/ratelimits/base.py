from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.utils.services import Service

if TYPE_CHECKING:
    from sentry.models import Project


class RateLimiter(Service):
    __all__ = ("is_limited", "validate", "current_value", "is_limited_with_value")

    window = 60

    def is_limited(
        self, key: str, limit: int, project: Project | None = None, window: int | None = None
    ) -> bool:
        is_limited, _, _ = self.is_limited_with_value(key, limit, project=project, window=window)
        return is_limited

    def current_value(
        self, key: str, project: Project | None = None, window: int | None = None
    ) -> int:
        return 0

    def is_limited_with_value(
        self, key: str, limit: int, project: Project | None = None, window: int | None = None
    ) -> tuple[bool, int, int]:
        return False, 0, 0

    def validate(self) -> None:
        raise NotImplementedError
