from typing import Mapping, Optional, Set

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import KeyResult, KeyResults, StringIndexer


class CloudSpannerIndexer(StringIndexer):
    def bulk_record(
        self, use_case_id: UseCaseKey, org_strings: Mapping[int, Set[str]]
    ) -> KeyResults:
        # Currently just calls record() on each item. We may want to consider actually recording
        # in batches though.
        key_results = KeyResults()

        for (org_id, strings) in org_strings.items():
            for string in strings:
                result = self.record(use_case_id, org_id, string)
                key_results.add_key_result(KeyResult(org_id, string, result))

        return key_results

    def record(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        raise NotImplementedError

    def resolve(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        raise NotImplementedError

    def reverse_resolve(self, use_case_id: UseCaseKey, id: int) -> Optional[str]:
        raise NotImplementedError
