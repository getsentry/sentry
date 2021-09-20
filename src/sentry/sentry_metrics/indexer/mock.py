import itertools
from typing import DefaultDict, Dict, Optional

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
    "init": 12,
    "session.error": 13,
}


class SimpleIndexer(StringIndexer):

    """Simple indexer with in-memory store. Do not use in production."""

    def __init__(self) -> None:
        self._counter = itertools.count(start=len(_STRINGS))
        self._strings: Dict[str, int] = DefaultDict(self._counter.__next__)
        self._reverse: Dict[int, str] = {}

    def record(self, organization: Organization, use_case: UseCase, string: str) -> int:
        # NOTE: Ignores ``use_case`` for simplicity.
        index = self._strings[string]
        self._reverse[index] = string
        return index

    def resolve(self, organization: Organization, use_case: UseCase, string: str) -> Optional[int]:
        # NOTE: Ignores ``use_case`` for simplicity.
        return self._strings.get(string)

    def reverse_resolve(
        self, organization: Organization, use_case: UseCase, id: int
    ) -> Optional[str]:
        # NOTE: Ignores ``use_case`` for simplicity.
        return self._reverse.get(id)


class MockIndexer(SimpleIndexer):
    """
    Mock string indexer. Comes with a prepared set of strings.
    """

    def __init__(self) -> None:
        super().__init__()
        for string, index in _STRINGS.items():
            self._strings[string] = index
            self._reverse[index] = string
