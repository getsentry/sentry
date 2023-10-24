from typing import Mapping, Set

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import FetchType, Metadata, UseCaseKeyCollection
from sentry.sentry_metrics.indexer.cache import CachingIndexer
from sentry.sentry_metrics.indexer.postgres.postgres_v2 import PGStringIndexerV2, indexer_cache
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


def assert_fetch_type_for_tag_string_set(
    meta: Mapping[str, Metadata], fetch_type: FetchType, str_set: Set[str]
):
    assert all([meta[string].fetch_type == fetch_type for string in str_set])


class PostgresIndexerV2Test(TestCase):
    def setUp(self) -> None:
        self.strings = {"hello", "hey", "hi"}
        self.indexer = CachingIndexer(indexer_cache, PGStringIndexerV2())
        self.org2 = self.create_organization()
        self.use_case_id = UseCaseID.SESSIONS
        self.use_case_key = UseCaseKey.RELEASE_HEALTH
        self.cache_namespace = self.use_case_id.value

    def tearDown(self) -> None:
        cache.clear()

    def test_get_db_records(self):
        """
        Make sure that calling `_get_db_records` doesn't populate the cache
        """
        key = f"{self.use_case_id.value}:123:oop"

        assert indexer_cache.get("br", key) is None

        assert isinstance(self.indexer.indexer, PGStringIndexerV2)
        self.indexer.indexer._get_db_records(
            UseCaseKeyCollection({self.use_case_id: {123: {"oop"}}})
        )

        assert indexer_cache.get("br", key) is None
