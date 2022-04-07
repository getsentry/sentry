import itertools
from collections import defaultdict
from typing import DefaultDict, Dict, MutableMapping, Optional, Set

from sentry.sentry_metrics.sessions import SessionMetricKey

from .base import BulkRecordResult, StringIndexer

_STRINGS = (
    "crashed",
    "environment",
    "errored",
    "healthy",
    "production",
    "release",
    SessionMetricKey.SESSION_DURATION.value,
    "session.status",
    SessionMetricKey.SESSION.value,
    "staging",
    SessionMetricKey.USER.value,
    "init",
    SessionMetricKey.SESSION_ERROR.value,
    "abnormal",
    "exited",
)


class SimpleIndexer(StringIndexer):

    """Simple indexer with in-memory store. Do not use in production."""

    def __init__(self) -> None:
        self._counter = itertools.count(start=1)
        self._strings: DefaultDict[str, int] = defaultdict(self._counter.__next__)
        self._reverse: Dict[int, str] = {}

    def bulk_record(self, org_strings: MutableMapping[int, Set[str]]) -> BulkRecordResult:
        strings = set()
        for _, strs in org_strings.items():
            strings.update(strs)
        return BulkRecordResult(
            mapping={string: self._record(string) for string in strings}, meta={}
        )

    def record(self, org_id: int, string: str) -> int:
        return self._record(string)

    def resolve(self, org_id: int, string: str) -> Optional[int]:
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
