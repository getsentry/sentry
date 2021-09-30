from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.testutils.cases import TestCase


class PostgresIndexerTest(TestCase):
    def setUp(self) -> None:
        self.org_id = self.create_organization().id
        self.indexer = PGStringIndexer()

    def test_indexer(self):
        results = PGStringIndexer().bulk_record(org_id=self.org_id, strings=["hello", "hey", "hi"])
        assert list(results.values()) == [1, 2, 3]

        obj = MetricsKeyIndexer.objects.get(string="hello")
        assert PGStringIndexer().resolve(self.org_id, "hello") == obj.id
        assert PGStringIndexer().reverse_resolve(self.org_id, obj.id) == obj.string
