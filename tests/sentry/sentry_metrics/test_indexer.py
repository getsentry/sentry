from sentry.sentry_metrics.indexer.mock import MockIndexer, UseCase, get_client

INDEXER = MockIndexer()

from sentry.testutils import TestCase


class MockIndexerTest(TestCase):
    def setUp(self) -> None:
        self.org_id = self.create_organization().id
        self.key = f"temp-metrics-indexer:{self.org_id}:1:str:test-metric"
        self.indexer = MockIndexer()

    def tearDown(self) -> None:
        get_client().flushdb()

    def test_indexer(self) -> None:
        value = abs(hash("test-metric")) % 10 ** 8
        self.indexer.record(self.org_id, UseCase.METRIC, "test-metric")
        # test string to int conversion saved
        assert int(get_client().get(self.key)) == value
        # test int to string conversion saved
        assert self.indexer.reverse_resolve(self.org_id, UseCase.METRIC, value) == "test-metric"
        # test value that doesn't exist
        assert self.indexer.reverse_resolve(self.org_id, UseCase.METRIC, 1234) is None
