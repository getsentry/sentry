from sentry.sentry_metrics.indexer.cache import indexer_cache
from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer, StringIndexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.sentry_metrics.indexer.postgres_v2 import (
    KeyCollection,
    KeyResult,
    KeyResults,
    PGStringIndexerV2,
    StaticStringsIndexerDecorator,
)
from sentry.sentry_metrics.indexer.strings import SHARED_STRINGS
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class PostgresIndexerTest(TestCase):
    def setUp(self) -> None:
        self.indexer = PGStringIndexer()

    def test_indexer(self):
        org_id = self.organization.id
        org_strings = {org_id: {"hello", "hey", "hi"}}
        results = PGStringIndexer().bulk_record(org_strings=org_strings)
        obj_ids = MetricsKeyIndexer.objects.filter(string__in=["hello", "hey", "hi"]).values_list(
            "id", flat=True
        )
        assert set(results.values()) == set(obj_ids)

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


class StaticStringsIndexerTest(TestCase):
    def setUp(self) -> None:
        self.indexer = StaticStringsIndexerDecorator()

    def test_static_strings_only(self) -> None:
        org_strings = {2: {"release"}, 3: {"production", "environment", "release"}}
        results = self.indexer.bulk_record(org_strings=org_strings)

        assert results[2]["release"] == SHARED_STRINGS["release"]
        assert results[3]["production"] == SHARED_STRINGS["production"]
        assert results[3]["environment"] == SHARED_STRINGS["environment"]
        assert results[3]["release"] == SHARED_STRINGS["release"]

    def test_static_and_non_static_strings(self):
        org_strings = {
            2: {"release", "1.0.0"},
            3: {"production", "environment", "release", "2.0.0"},
        }
        results = self.indexer.bulk_record(org_strings=org_strings)

        v1 = StringIndexer.objects.get(organization_id=2, string="1.0.0")
        v2 = StringIndexer.objects.get(organization_id=3, string="2.0.0")

        assert results[2]["release"] == SHARED_STRINGS["release"]
        assert results[3]["production"] == SHARED_STRINGS["production"]
        assert results[3]["environment"] == SHARED_STRINGS["environment"]
        assert results[3]["release"] == SHARED_STRINGS["release"]

        assert results[2]["1.0.0"] == v1.id
        assert results[3]["2.0.0"] == v2.id


class PostgresIndexerV2Test(TestCase):
    def setUp(self) -> None:
        self.strings = {"hello", "hey", "hi"}
        self.indexer = PGStringIndexerV2()
        self.org2 = self.create_organization()

    def tearDown(self) -> None:
        cache.clear()

    def test_indexer(self):
        org1_id = self.organization.id
        org2_id = self.org2.id
        org_strings = {org1_id: self.strings, org2_id: {"sup"}}

        # create a record with diff org_id but same string that we test against
        StringIndexer.objects.create(organization_id=999, string="hey")

        assert list(
            indexer_cache.get_many([f"{org1_id}:{string}" for string in self.strings]).values()
        ) == [None, None, None]

        results = self.indexer.bulk_record(org_strings=org_strings)

        org1_string_ids = list(
            StringIndexer.objects.filter(
                organization_id=org1_id, string__in=["hello", "hey", "hi"]
            ).values_list("id", flat=True)
        )
        org2_string_id = StringIndexer.objects.get(organization_id=org2_id, string="sup").id

        # verify org1 results and cache values
        for value in results[org1_id].values():
            assert value in org1_string_ids

        for cache_value in indexer_cache.get_many(
            [f"{org1_id}:{string}" for string in self.strings]
        ).values():
            assert cache_value in org1_string_ids

        # verify org2 results and cache values
        assert results[org2_id]["sup"] == org2_string_id
        assert indexer_cache.get(f"{org2_id}:sup") == org2_string_id

        # we should have no results for org_id 999
        assert not results.get(999)

    def test_resolve_and_reverse_resolve(self) -> None:
        """
        Test `resolve` and `reverse_resolve` methods
        """
        org1_id = self.organization.id
        org_strings = {org1_id: self.strings}
        PGStringIndexerV2().bulk_record(org_strings=org_strings)

        # test resolve and reverse_resolve
        obj = StringIndexer.objects.get(string="hello")
        assert self.indexer.resolve(org1_id, "hello") == obj.id
        assert self.indexer.reverse_resolve(obj.id) == obj.string

        # test record on a string that already exists
        self.indexer.record(org1_id, "hello")
        assert self.indexer.resolve(org1_id, "hello") == obj.id

        # test invalid values
        assert self.indexer.resolve(org1_id, "beep") is None
        assert self.indexer.reverse_resolve(1234) is None

    def test_already_created_plus_written_results(self) -> None:
        """
        Test that we correctly combine db read results with db write results
        for the same organization.
        """
        org_id = 1234
        v0 = StringIndexer.objects.create(organization_id=org_id, string="v1.2.0")
        v1 = StringIndexer.objects.create(organization_id=org_id, string="v1.2.1")
        v2 = StringIndexer.objects.create(organization_id=org_id, string="v1.2.2")

        expected_mapping = {"v1.2.0": v0.id, "v1.2.1": v1.id, "v1.2.2": v2.id}

        results = PGStringIndexerV2().bulk_record(
            org_strings={org_id: {"v1.2.0", "v1.2.1", "v1.2.2"}}
        )
        assert len(results[org_id]) == len(expected_mapping) == 3

        for string, id in results[org_id].items():
            assert expected_mapping[string] == id

        results = PGStringIndexerV2().bulk_record(
            org_strings={org_id: {"v1.2.0", "v1.2.1", "v1.2.2", "v1.2.3"}}
        )

        v3 = StringIndexer.objects.get(organization_id=org_id, string="v1.2.3")
        expected_mapping["v1.2.3"] = v3.id

        assert len(results[org_id]) == len(expected_mapping) == 4

        for string, id in results[org_id].items():
            assert expected_mapping[string] == id

    def test_already_cached_plus_read_results(self) -> None:
        """
        Test that we correctly combine cached results with read results
        for the same organization.
        """
        org_id = 8
        cached = {f"{org_id}:beep": 10, f"{org_id}:boop": 11}
        indexer_cache.set_many(cached)

        results = PGStringIndexerV2().bulk_record(org_strings={org_id: {"beep", "boop"}})
        assert len(results[org_id]) == 2
        assert results[org_id]["beep"] == 10
        assert results[org_id]["boop"] == 11

        # confirm we did not write to the db if results were already cached
        assert not StringIndexer.objects.filter(organization_id=org_id, string__in=["beep", "boop"])

        bam = StringIndexer.objects.create(organization_id=org_id, string="bam")
        results = PGStringIndexerV2().bulk_record(org_strings={org_id: {"beep", "boop", "bam"}})
        assert len(results[org_id]) == 3
        assert results[org_id]["beep"] == 10
        assert results[org_id]["boop"] == 11
        assert results[org_id]["bam"] == bam.id

    def test_get_db_records(self):
        """
        Make sure that calling `_get_db_records` doesn't populate the cache
        """
        string = StringIndexer.objects.create(organization_id=123, string="oop")
        collection = KeyCollection({123: {"oop"}})
        key = "123:oop"

        assert indexer_cache.get(key) is None
        assert indexer_cache.get(string.id) is None

        self.indexer._get_db_records(collection)

        assert indexer_cache.get(string.id) is None
        assert indexer_cache.get(key) is None


class KeyCollectionTest(TestCase):
    def test_no_data(self) -> None:
        collection = KeyCollection({})
        assert collection.mapping == {}
        assert collection.size == 0

        assert collection.as_tuples() == []
        assert collection.as_strings() == []

    def test_basic(self) -> None:
        org_strings = {1: {"a", "b", "c"}, 2: {"e", "f"}}

        collection = KeyCollection(org_strings)
        collection_tuples = [(1, "a"), (1, "b"), (1, "c"), (2, "e"), (2, "f")]
        collection_strings = ["1:a", "1:b", "1:c", "2:e", "2:f"]

        assert collection.mapping == org_strings
        assert collection.size == 5
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
