from typing import List, Optional, Tuple

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

_METRICS = [
    "session.duration",
    "session",
    "user",
]

_TAGS = {
    "environment": [
        "production",
        "staging",
    ],
    "session.status": [
        "abnormal",
        "crashed",
        "errored",
        "healthy",
    ],
}


class MockIndexer(StringIndexer):
    """
    Mock string indexer
    """

    def record_metric(self, project: Project, string: str) -> int:
        """Mock indexer cannot record."""
        raise NotImplementedError

    def record_tag(self, project: Project, metric: str, key: str, value: str) -> Tuple[int, int]:
        """Mock indexer cannot record."""
        raise NotImplementedError

    def resolve(self, project: Project, use_case: UseCase, string: str) -> Optional[int]:
        return _STRINGS.get(string)

    def reverse_resolve(self, project: Project, use_case: UseCase, id: int) -> Optional[str]:
        return _REVERSE.get(id)
