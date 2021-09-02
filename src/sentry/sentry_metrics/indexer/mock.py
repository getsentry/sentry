from typing import Optional

from sentry.models import Organization

from .base import StringIndexer, UseCase

_STRINGS = {
    "abnormal": 0,
    "crashed": 1,
    "environment": 2,
    "errored": 3,
    "healthy": 4,
    "production": 5,
    "release": 6,
    "session.duration": 7,
    "session.status": 8,
    "session": 9,
    "staging": 10,
    "user": 11,
}
_REVERSE = {v: k for k, v in _STRINGS.items()}


class MockIndexer(StringIndexer):
    """
    Mock string indexer
    """

    def record(self, organization: Organization, use_case: UseCase, string: str) -> int:
        """Mock indexer cannot record."""
        raise NotImplementedError()

    def resolve(self, organization: Organization, use_case: UseCase, string: str) -> Optional[int]:
        # NOTE: Ignores ``use_case`` for simplicity.
        return _STRINGS.get(string)

    def reverse_resolve(
        self, organization: Organization, use_case: UseCase, id: int
    ) -> Optional[str]:
        # NOTE: Ignores ``use_case`` for simplicity.
        return _REVERSE.get(id)
