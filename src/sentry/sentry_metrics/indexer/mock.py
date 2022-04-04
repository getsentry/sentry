import itertools
from collections import defaultdict
from typing import DefaultDict, Dict, MutableMapping, Optional, Set

from sentry.sentry_metrics.sessions import SessionMetricKey

from .base import StringIndexer

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
    # to be replaces by SessionMetricKey once switched
    "c:sessions/session@none",
    "s:sessions/error@none",
    "s:sessions/user@none",
    "d:sessions/duration@second",
)


class SimpleIndexer(StringIndexer):
    def __init__(self) -> None:
        self._counter = itertools.count(start=1)
        self._strings: DefaultDict[int, DefaultDict[str, int]] = defaultdict(
            lambda: defaultdict(self._counter.__next__)
        )
        self._reverse: Dict[int, str] = {}

    def bulk_record(
        self, org_strings: MutableMapping[int, Set[str]]
    ) -> MutableMapping[int, MutableMapping[str, int]]:
        result = {}
        for org_id, strs in org_strings.items():
            strings_to_ints = {string: self._record(org_id, string) for string in strs}
            result[org_id] = strings_to_ints

        return result

    def record(self, org_id: int, string: str) -> int:
        return self._record(org_id, string)

    def resolve(self, org_id: int, string: str) -> Optional[int]:
        if string in _STRINGS:
            org_id = 0
        return self._strings.get(org_id, {}).get(string)

    def reverse_resolve(self, id: int) -> Optional[str]:
        return self._reverse.get(id)

    def _record(self, org_id: int, string: str) -> int:
        index = self._strings[org_id][string]
        self._reverse[index] = string
        return index


class MockIndexer(SimpleIndexer):
    """
    Mock string indexer. Comes with a prepared set of strings.
    """

    def __init__(self) -> None:
        super().__init__()
        for string in _STRINGS:
            self._record(0, string)
