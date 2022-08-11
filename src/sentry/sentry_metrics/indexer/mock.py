import itertools
from collections import defaultdict
from typing import DefaultDict, Dict, Mapping, Optional, Set

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import (
    FetchType,
    KeyCollection,
    KeyResult,
    KeyResults,
    StringIndexer,
)
from sentry.sentry_metrics.indexer.ratelimiters import writes_limiter
from sentry.sentry_metrics.indexer.strings import StaticStringsIndexer


class RawSimpleIndexer(StringIndexer):

    """Simple indexer with in-memory store. Do not use in production."""

    def __init__(self) -> None:
        self._counter = itertools.count(start=10000)
        self._strings: DefaultDict[int, DefaultDict[str, Optional[int]]] = defaultdict(
            lambda: defaultdict(self._counter.__next__)
        )
        self._reverse: Dict[int, str] = {}

    def bulk_record(
        self, use_case_id: UseCaseKey, org_strings: Mapping[int, Set[str]]
    ) -> KeyResults:
        db_read_keys = KeyCollection(org_strings)
        db_read_key_results = KeyResults()
        for org_id, strs in org_strings.items():
            for string in strs:
                id = self.resolve(use_case_id, org_id, string)
                if id is not None:
                    db_read_key_results.add_key_result(
                        KeyResult(org_id=org_id, string=string, id=id), fetch_type=FetchType.DB_READ
                    )

        db_write_keys = db_read_key_results.get_unmapped_keys(db_read_keys)

        if db_write_keys.size == 0:
            return db_read_key_results

        with writes_limiter.check_write_limits(use_case_id, db_write_keys) as writes_limiter_state:
            # After the DB has successfully committed writes, we exit this
            # context manager and consume quotas. If the DB crashes we
            # shouldn't consume quota.
            filtered_db_write_keys = writes_limiter_state.accepted_keys
            del db_write_keys

            rate_limited_key_results = KeyResults()
            for dropped_string in writes_limiter_state.dropped_strings:
                rate_limited_key_results.add_key_result(
                    dropped_string.key_result,
                    fetch_type=dropped_string.fetch_type,
                    fetch_type_ext=dropped_string.fetch_type_ext,
                )

            if filtered_db_write_keys.size == 0:
                return db_read_key_results.merge(rate_limited_key_results)

            db_write_key_results = KeyResults()
            for org_id, string in filtered_db_write_keys.as_tuples():
                db_write_key_results.add_key_result(
                    KeyResult(org_id=org_id, string=string, id=self._record(org_id, string)),
                    fetch_type=FetchType.FIRST_SEEN,
                )

        return db_read_key_results.merge(db_write_key_results).merge(rate_limited_key_results)

    def record(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        return self._record(org_id, string)

    def resolve(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        strs = self._strings[org_id]
        return strs.get(string)

    def reverse_resolve(self, use_case_id: UseCaseKey, id: int) -> Optional[str]:
        return self._reverse.get(id)

    def _record(self, org_id: int, string: str) -> Optional[int]:
        index = self._strings[org_id][string]
        if index is not None:
            self._reverse[index] = string
        return index


class SimpleIndexer(StaticStringsIndexer):
    def __init__(self) -> None:
        super().__init__(RawSimpleIndexer())


class MockIndexer(SimpleIndexer):
    """
    Mock string indexer. Comes with a prepared set of strings.
    """
