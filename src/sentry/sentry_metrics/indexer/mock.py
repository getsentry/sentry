from typing import Optional

from sentry.models import Project

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

    def resolve(self, project: Project, use_case: UseCase, string: str) -> Optional[int]:
        """Lookup the integer ID for a string.

        Returns None if the entry cannot be found.
        """
        return _STRINGS.get(string)

    def reverse_resolve(self, project: Project, use_case: UseCase, id: int) -> Optional[str]:
        """Lookup the stored string for a given integer ID.

        Returns None if the entry cannot be found.
        """
        return _REVERSE.get(id)
