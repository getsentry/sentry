from typing import Mapping, Optional, Set

from google.cloud import spanner

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import KeyResult, KeyResults, StringIndexer


class CloudSpannerIndexer(StringIndexer):
    """
    Provides integer IDs for metric names, tag keys and tag values
    and the corresponding reverse lookup.
    """

    def __init__(self, instance_id: str, database_id: str) -> None:
        self.instance_id = instance_id
        self.database_id = database_id
        self.instance = None
        self.database = None

    def setup(self) -> None:
        spanner_client = spanner.Client()
        self.instance = spanner_client.instance(self.instance_id)
        self.database = self.instance.database(self.database_id)

    def validate(self) -> None:
        """
        Run a simple query to ensure the database is accessible.
        """
        with self.database.snapshot() as snapshot:
            try:
                snapshot.execute_sql("SELECT 1")
            except ValueError:
                # TODO: What is the correct way to handle connection errors?
                pass

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

    def resolve(
        self, org_id: int, string: str, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[int]:
        raise NotImplementedError

    def reverse_resolve(
        self, id: int, use_case_id: UseCaseKey = UseCaseKey.RELEASE_HEALTH
    ) -> Optional[str]:
        raise NotImplementedError
