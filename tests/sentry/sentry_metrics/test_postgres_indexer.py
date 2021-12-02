from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.testutils.cases import TestCase


class PostgresIndexerTest(TestCase):
    def setUp(self) -> None:
        self.indexer = PGStringIndexer()

    def test_indexer(self):
        results = PGStringIndexer().bulk_record(strings=["hello", "hey", "hi"])
        obj_ids = list(
            MetricsKeyIndexer.objects.filter(string__in=["hello", "hey", "hi"]).values_list(
                "id", flat=True
            )
        )
        assert list(results.values()) == obj_ids

        # test resolve and reverse_resolve
        obj = MetricsKeyIndexer.objects.get(string="hello")
        assert PGStringIndexer().resolve("hello") == obj.id
        assert PGStringIndexer().reverse_resolve(obj.id) == obj.string

        # test record on a string that already exists
        PGStringIndexer().record("hello")
        assert PGStringIndexer().resolve("hello") == obj.id

        # test invalid values
        assert PGStringIndexer().resolve("beep") is None
        assert PGStringIndexer().reverse_resolve(1234) is None
