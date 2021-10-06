from django.core.cache import cache

from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.testutils.cases import TestCase


class PostgresIndexerTest(TestCase):
    def setUp(self) -> None:
        self.indexer = PGStringIndexer()

    def _get_cache_key(self, instance):
        return PGStringIndexer()._build_indexer_cache_key(instance)

    def test_indexer(self):
        results = PGStringIndexer().bulk_record(strings=["hello", "hey", "hi"])
        assert list(results.values()) == [1, 2, 3]

        # test resolve and reverse_resolve
        obj = MetricsKeyIndexer.objects.get(string="hello")
        assert PGStringIndexer().resolve("hello") == obj.id
        assert PGStringIndexer().reverse_resolve(obj.id) == obj.string

        # test both relationships (str -> int and int -> str) were cached
        assert cache.get(self._get_cache_key("hello")) == obj.id
        assert cache.get(self._get_cache_key(obj.id)) == "hello"

        # test record on a string that already exists
        PGStringIndexer().record("hello")
        assert PGStringIndexer().resolve("hello") == obj.id

        # test invalid values
        assert PGStringIndexer().resolve("beep") is None
        assert PGStringIndexer().reverse_resolve(1234) is None
