from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.testutils.cases import TestCase


class PostgresIndexerTest(TestCase):
    def setUp(self) -> None:
        self.indexer = PGStringIndexer()

    def test_indexer(self):
        org_id = self.organization.id
        org_strings = {org_id: {"hello", "hey", "hi"}}
        results = PGStringIndexer().bulk_record(org_strings=org_strings)
        obj_ids = list(
            MetricsKeyIndexer.objects.filter(string__in=["hello", "hey", "hi"]).values_list(
                "id", flat=True
            )
        )
        assert list(results.values()) == obj_ids

        # test resolve and reverse_resolve
        obj = MetricsKeyIndexer.objects.get(string="hello")
        assert PGStringIndexer().resolve(org_id, "hello") == obj.id
        assert PGStringIndexer().reverse_resolve(obj.id) == obj.string

        # test record on a string that already exists
        PGStringIndexer().record(org_id, "hello")
        assert PGStringIndexer().resolve(org_id, "hello") == obj.id

        # test invalid values
        assert PGStringIndexer().resolve(org_id, "beep") is None
        assert PGStringIndexer().reverse_resolve(1234) is None
