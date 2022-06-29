import itertools
from collections import defaultdict
from typing import DefaultDict, Dict, Mapping, Optional, Set

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.strings import REVERSE_SHARED_STRINGS, SHARED_STRINGS

from .base import KeyResult, KeyResults, StringIndexer


class SimpleIndexer(StringIndexer):

    """Simple indexer with in-memory store. Do not use in production."""

    def __init__(self) -> None:
        self._counter = itertools.count(start=10000)
        self._strings: DefaultDict[int, DefaultDict[str, int]] = defaultdict(
            lambda: defaultdict(self._counter.__next__)
        )
        self._reverse: Dict[int, str] = {}

    def bulk_record(
        self, use_case_id: UseCaseKey, org_strings: Mapping[int, Set[str]]
    ) -> KeyResults:
        acc = KeyResults()
        for org_id, strs in org_strings.items():
            strings_to_ints = {}
            for string in strs:
                if string in SHARED_STRINGS:
                    strings_to_ints[string] = SHARED_STRINGS[string]
                else:
                    strings_to_ints[string] = self._record(org_id, string)
                acc.add_key_result(KeyResult(org_id, string, strings_to_ints[string]))

        return acc

    def record(self, use_case_id: UseCaseKey, org_id: int, string: str) -> int:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self._record(org_id, string)

    def resolve(
        self, org_id: int, string: str, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[int]:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]

        strs = self._strings[org_id]
        return strs.get(string)

    def reverse_resolve(
        self, id: int, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[str]:
        if id in REVERSE_SHARED_STRINGS:
            return REVERSE_SHARED_STRINGS[id]
        return self._reverse.get(id)

    def _record(self, org_id: int, string: str) -> int:
        index = self._strings[org_id][string]
        self._reverse[index] = string
        return index


class MockIndexer(SimpleIndexer):
    """
    Mock string indexer. Comes with a prepared set of strings.
    """
