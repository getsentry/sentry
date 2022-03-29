from sentry.sentry_metrics.indexer.cache import indexer_cache
from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer, StringIndexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.sentry_metrics.indexer.postgres_v2 import (
    KeyCollection,
    KeyResult,
    KeyResults,
    PGStringIndexerV2,
)
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

        # create a record with diff org_id but same string that we test against
        StringIndexer.objects.create(organization_id=999, string="hey")

        assert list(
            indexer_cache.get_many([f"{org_id}:{string}" for string in self.strings]).values()
        ) == [None, None, None]

        results = PGStringIndexerV2().bulk_record(org_strings=org_strings)
        obj_ids = list(
            StringIndexer.objects.filter(
                organization_id=self.organization.id, string__in=["hello", "hey", "hi"]
            ).values_list("id", flat=True)
        )
        for value in results[org_id].values():
            assert value in obj_ids

        # we should have no results for org_id 999
        assert not results.get(999)

        for cache_value in indexer_cache.get_many(
            [f"{org_id}:{string}" for string in self.strings]
        ).values():
            assert cache_value in obj_ids

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


class KeyCollectionTest(TestCase):
    def test_no_data(self) -> None:
        collection = KeyCollection({})
        assert collection.mapping == {}

        assert collection.as_tuples() == []
        assert collection.as_strings() == []

    def test_basic(self) -> None:
        org_strings = {1: {"a", "b", "c"}, 2: {"e", "f"}}

        collection = KeyCollection(org_strings)
        collection_tuples = [(1, "a"), (1, "b"), (1, "c"), (2, "e"), (2, "f")]
        collection_strings = ["1:a", "1:b", "1:c", "2:e", "2:f"]

        assert collection.mapping == org_strings
        assert list(collection.as_tuples()).sort() == collection_tuples.sort()
        assert list(collection.as_strings()).sort() == collection_strings.sort()


class KeyResultsTest(TestCase):
    def test_basic(self) -> None:
        key_results = KeyResults()

        assert key_results.results == {}
        assert key_results.get_mapped_results() == {}
        assert key_results.get_mapped_key_strings_to_ints() == {}

        org_strings = {1: {"a", "b", "c"}, 2: {"e", "f"}}
        collection = KeyCollection(org_strings)

        assert key_results.get_unmapped_keys(collection).mapping == org_strings

        key_result = KeyResult(1, "a", 10)
        key_results.add_key_results([key_result])

        assert key_results.get_mapped_key_strings_to_ints() == {"1:a": 10}
        assert key_results.get_mapped_results() == {1: {"a": 10}}

        assert key_results.get_unmapped_keys(collection).mapping == {1: {"b", "c"}, 2: {"e", "f"}}

        key_result_list = [
            KeyResult(1, "a", 10),
            KeyResult(1, "b", 11),
            KeyResult(1, "c", 12),
            KeyResult(2, "e", 13),
            KeyResult(2, "f", 14),
        ]
        key_results.add_key_results(key_result_list)

        assert key_results.get_mapped_key_strings_to_ints() == {
            "1:a": 10,
            "1:b": 11,
            "1:c": 12,
            "2:e": 13,
            "2:f": 14,
        }
        assert key_results.get_mapped_results() == {
            1: {"a": 10, "b": 11, "c": 12},
            2: {"e": 13, "f": 14},
        }

        assert key_results.get_unmapped_keys(collection).mapping == {}
