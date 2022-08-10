from typing import Mapping, Optional, Set

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import KeyCollection, KeyResult, KeyResults, StringIndexer
from sentry.sentry_metrics.indexer.strings import REVERSE_SHARED_STRINGS, SHARED_STRINGS

from .base import FetchType


class StaticStringIndexer(StringIndexer):
    """
    Wrapper for static strings
    """

    def __init__(self, indexer: StringIndexer) -> None:
        self.indexer = indexer

    def bulk_record(
        self, use_case_id: UseCaseKey, org_strings: Mapping[int, Set[str]]
    ) -> KeyResults:
        static_keys = KeyCollection(org_strings)
        static_key_results = KeyResults()
        for org_id, string in static_keys.as_tuples():
            if string in SHARED_STRINGS:
                id = SHARED_STRINGS[string]
                static_key_results.add_key_result(
                    KeyResult(org_id, string, id), FetchType.HARDCODED
                )

        org_strings_left = static_key_results.get_unmapped_keys(static_keys)

        if org_strings_left.size == 0:
            return static_key_results

        indexer_results = self.indexer.bulk_record(
            use_case_id=use_case_id, org_strings=org_strings_left.mapping
        )

        return static_key_results.merge(indexer_results)

    def record(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self.indexer.record(use_case_id=use_case_id, org_id=org_id, string=string)

    def resolve(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        if string in SHARED_STRINGS:
            return SHARED_STRINGS[string]
        return self.indexer.resolve(use_case_id=use_case_id, org_id=org_id, string=string)

    def reverse_resolve(self, use_case_id: UseCaseKey, id: int) -> Optional[str]:
        if id in REVERSE_SHARED_STRINGS:
            return REVERSE_SHARED_STRINGS[id]
        return self.indexer.reverse_resolve(use_case_id=use_case_id, id=id)
