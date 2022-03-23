from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer, StringIndexer, indexer_cache
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.sentry_metrics.indexer.postgres_v2 import PGStringIndexerV2
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
        assert PGStringIndexer().resolve("hello") == obj.id
        assert PGStringIndexer().reverse_resolve(obj.id) == obj.string

        # test record on a string that already exists
        PGStringIndexer().record(org_id, "hello")
        assert PGStringIndexer().resolve("hello") == obj.id

        # test invalid values
        assert PGStringIndexer().resolve("beep") is None
        assert PGStringIndexer().reverse_resolve(1234) is None


class PostgresIndexerV2Test(TestCase):
    def setUp(self) -> None:
        self.strings = {"hello", "hey", "hi"}
        self.indexer = PGStringIndexerV2()

    def tearDown(self) -> None:
        for obj in StringIndexer.objects.all():
            key = f"{obj.organization_id}:{obj.string}"
            indexer_cache.delete(key)
            indexer_cache.delete(obj.id)

    def test_indexer(self):
        org_id = self.organization.id
        org_strings = {org_id: self.strings}

        assert list(
            indexer_cache.get_many([f"{org_id}:{string}" for string in self.strings]).values()
        ) == [None, None, None]

        results = PGStringIndexerV2().bulk_record(org_strings=org_strings)
        obj_ids = list(
            StringIndexer.objects.filter(string__in=["hello", "hey", "hi"]).values_list(
                "id", flat=True
            )
        )
        assert list(results[org_id].values()) == obj_ids
        assert (
            list(indexer_cache.get_many([f"{org_id}:{string}" for string in self.strings]).values())
            == obj_ids
        )

        # test resolve and reverse_resolve
        obj = StringIndexer.objects.get(string="hello")
        assert PGStringIndexerV2().resolve(org_id, "hello") == obj.id
        assert PGStringIndexerV2().reverse_resolve(obj.id) == obj.string

        # test record on a string that already exists
        PGStringIndexerV2().record(org_id, "hello")
        assert PGStringIndexerV2().resolve(org_id, "hello") == obj.id

        # test invalid values
        assert PGStringIndexerV2().resolve(org_id, "beep") is None
        assert PGStringIndexerV2().reverse_resolve(1234) is None
