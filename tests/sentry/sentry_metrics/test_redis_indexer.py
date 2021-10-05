from sentry.sentry_metrics.indexer.redis_mock import RedisMockIndexer, get_client, get_int

INDEXER = RedisMockIndexer()

from sentry.testutils import TestCase


class RedisMockIndexerTest(TestCase):
    def setUp(self) -> None:
        self.indexer = RedisMockIndexer()

    def tearDown(self) -> None:
        get_client().flushdb()

    def test_bulk_record(self) -> None:
        strings = ["test-metric", "test-tag-key", "test-tag-value"]
        results = self.indexer.bulk_record(strings)
        assert results == {s: get_int(s) for s in strings}

    def test_resolve(self) -> None:
        strings = ["test-metric"]
        self.indexer.bulk_record(strings)
        assert self.indexer.resolve("test-metric") == get_int("test-metric")
        assert self.indexer.resolve("bad-value") is None

    def test_reverse_resolve(self) -> None:
        strings = ["test-metric"]
        self.indexer.bulk_record(strings)
        assert self.indexer.reverse_resolve(get_int("test-metric")) == "test-metric"
        assert self.indexer.reverse_resolve(55555) is None
