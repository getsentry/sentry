from django.db import connection

from sentry.sentry_metrics.indexer.postgres import StringIndexer
from sentry.testutils import TestCase


class PostgresIndexerTest(TestCase):
    def setUp(self) -> None:
        self.org_id = self.create_organization().id
        self.indexer = StringIndexer()

        self._create_sequence()

    def _create_sequence(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "CREATE SEQUENCE metricskeyindexer_value OWNED BY sentry_metricskeyindexer.value"
            )

    def _drop_sequence(self):
        with connection.cursor() as cursor:
            cursor.execute("DROP SEQUENCE IF EXISTS metricskeyindexer_value")

    def tearDown(self) -> None:
        self._drop_sequence()

    def test_create(self):
        results = StringIndexer().bulk_record(org_id=self.org_id, strings=["hello", "hey", "hi"])
        assert list(results.values()) == [1, 2, 3]
