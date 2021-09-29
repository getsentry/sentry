from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from tests.snuba.snuba.test_indexer_consumer import MetricsIndexerTestCase


class PostgresIndexerTest(MetricsIndexerTestCase):
    def setUp(self) -> None:
        self.org_id = self.create_organization().id
        self.indexer = PGStringIndexer()
        self._create_sequence()

    def tearDown(self) -> None:
        self._drop_sequence()

    def test_indexer(self):
        results = PGStringIndexer().bulk_record(org_id=self.org_id, strings=["hello", "hey", "hi"])
        assert list(results.values()) == [1, 2, 3]

        obj = MetricsKeyIndexer.objects.get(key="hello")
        assert PGStringIndexer().resolve(self.org_id, "hello") == obj.value
        assert PGStringIndexer().reverse_resolve(self.org_id, obj.value) == obj.key
