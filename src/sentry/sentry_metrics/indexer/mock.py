import itertools
from collections import defaultdict
from typing import DefaultDict, Dict, Optional

from .base import StringIndexer

_STRINGS = (
    "abnormal",
    "crashed",
    "environment",
    "errored",
    "healthy",
    "production",
    "release",
    "session.duration",
    "session.status",
    "session",
    "staging",
    "user",
    "init",
    "session.error",
)


class SimpleIndexer(StringIndexer):

    """Simple indexer with in-memory store. Do not use in production."""

    def __init__(self) -> None:
        self._counter = itertools.count()
        self._strings: DefaultDict[str, int] = defaultdict(self._counter.__next__)
        self._reverse: Dict[int, str] = {}

    def record(self, string: str) -> int:
        return self._record(string)

    def resolve(self, string: str) -> Optional[int]:
        return self._strings.get(string)

    def reverse_resolve(self, id: int) -> Optional[str]:
        return self._reverse.get(id)

    def _record(self, string: str) -> int:
        index = self._strings[string]
        self._reverse[index] = string
        return index


class MockIndexer(SimpleIndexer):
    """
    Mock string indexer. Comes with a prepared set of strings.
    """

    def __init__(self) -> None:
        super().__init__()
        for string in _STRINGS:
            self._record(string)
