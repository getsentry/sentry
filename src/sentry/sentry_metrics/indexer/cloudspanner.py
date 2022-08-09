from typing import Mapping, Optional, Set

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import KeyResults, StringIndexer


class CloudSpannerIndexer(StringIndexer):
    def bulk_record(
        self, use_case_id: UseCaseKey, org_strings: Mapping[int, Set[str]]
    ) -> KeyResults:
        # Currently just calls record() on each item. We may want to consider actually recording
        # in batches though.
        for (org_id, strings) in org_strings.items():
            for string in strings:
                self.record(use_case_id, org_id, string)

    def record(self, use_case_id: UseCaseKey, org_id: int, string: str) -> Optional[int]:
        raise NotImplementedError

    def resolve(
        self, org_id: int, string: str, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[int]:
        raise NotImplementedError

    def reverse_resolve(
        self, id: int, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[str]:
        raise NotImplementedError
