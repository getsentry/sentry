import itertools
from collections import defaultdict
from typing import DefaultDict, Dict, Mapping, MutableMapping, Optional, Set

from ...snuba.metrics.naming_layer.mri import SessionMRI
from .base import StringIndexer

# todo actually map th
_STRINGS = (
    "crashed",
    "environment",
    "errored",
    "healthy",
    "production",
    "release",
    SessionMRI.RAW_DURATION.value,
    "session.status",
    SessionMRI.SESSION.value,
    "staging",
    SessionMRI.USER.value,
    "init",
    SessionMRI.ERROR.value,
    "abnormal",
    "exited",
)


class SimpleIndexer(StringIndexer):

    """Simple indexer with in-memory store. Do not use in production."""

    def __init__(self) -> None:
        self._counter = itertools.count(start=10000)
        self._strings: DefaultDict[int, DefaultDict[str, int]] = defaultdict(
            lambda: defaultdict(self._counter.__next__)
        )
        self._reverse: Dict[int, str] = {}

    def bulk_record(self, org_strings: Mapping[int, Set[str]]) -> Mapping[int, Mapping[str, int]]:
        result: MutableMapping[int, MutableMapping[str, int]] = {}
        for org_id, strs in org_strings.items():
            strings_to_ints = {string: self._record(org_id, string) for string in strs}
            result[org_id] = strings_to_ints

        return result

    def record(self, org_id: int, string: str) -> int:
        return self._record(org_id, string)

    def resolve(self, org_id: int, string: str) -> Optional[int]:
        if string in _STRINGS:
            org_id = 0
        strs = self._strings[org_id]
        return strs.get(string)

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
