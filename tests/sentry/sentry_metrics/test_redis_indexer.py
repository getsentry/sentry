from sentry.sentry_metrics.indexer.redis_mock import RedisMockIndexer, get_client, get_int

INDEXER = RedisMockIndexer()

from sentry.testutils import TestCase


class RedisMockIndexerTest(TestCase):
    def setUp(self) -> None:
        self.org_id = self.create_organization().id
        self.key_base = f"temp-metrics-indexer:{self.org_id}:1:"
        self.indexer = RedisMockIndexer()

    def tearDown(self) -> None:
        get_client().flushdb()

    def test_bulk_record(self) -> None:
        strings = ["test-metric", "test-tag-key", "test-tag-value"]
        results = self.indexer.bulk_record(self.org_id, strings)
        assert results == {s: get_int(s) for s in strings}

    def test_resolve(self) -> None:
        strings = ["test-metric"]
        self.indexer.bulk_record(self.org_id, strings)
        assert self.indexer.resolve(self.org_id, "test-metric") == get_int("test-metric")
        assert self.indexer.resolve(self.org_id, "bad-value") is None

    def test_reverse_resolve(self) -> None:
        strings = ["test-metric"]
        self.indexer.bulk_record(self.org_id, strings)
        assert self.indexer.reverse_resolve(self.org_id, get_int("test-metric")) == "test-metric"
        assert self.indexer.reverse_resolve(self.org_id, 55555) is None
