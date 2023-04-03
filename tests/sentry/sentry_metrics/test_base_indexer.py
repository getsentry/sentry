from typing import Mapping, Set
from unittest import TestCase

from sentry.sentry_metrics.indexer.base import (
    FetchType,
    FetchTypeExt,
    KeyCollection,
    KeyResult,
    KeyResults,
    Metadata,
    UseCaseCollection,
)


def assert_fetch_type_for_tag_string_set(
    meta: Mapping[str, Metadata], fetch_type: FetchType, str_set: Set[str]
):
    assert all([meta[string].fetch_type == fetch_type for string in str_set])


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
        assert sorted(list(collection.as_tuples())) == sorted(collection_tuples)
        assert sorted(list(collection.as_strings())) == sorted(collection_strings)


class UseCaseCollectionTest(TestCase):
    def test_no_date(self) -> None:
        collection = UseCaseCollection({})
        assert collection.mapping == {}
        assert collection.size == 0

        assert collection.as_tuples() == []
        assert collection.as_strings() == []

    def test_basic(self) -> None:
        org_strings = {
            "use_case_1": {1: {"a", "b", "c"}, 2: {"e", "f"}},
            "use_case_2": {1: {"a", "b", "c"}, 4: {"g", "f"}},
            "use_case_3": {5: {"k"}},
        }

        collection = UseCaseCollection(org_strings)
        collection_tuples = [
            ("use_case_1", 1, "a"),
            ("use_case_1", 1, "b"),
            ("use_case_1", 1, "c"),
            ("use_case_1", 2, "e"),
            ("use_case_1", 2, "f"),
            ("use_case_2", 1, "a"),
            ("use_case_2", 1, "b"),
            ("use_case_2", 1, "c"),
            ("use_case_2", 4, "g"),
            ("use_case_2", 4, "f"),
            ("use_case_3", 5, "k"),
        ]
        collection_strings = [
            "use_case_1:1:a",
            "use_case_1:1:b",
            "use_case_1:1:c",
            "use_case_1:2:e",
            "use_case_1:2:f",
            "use_case_2:1:a",
            "use_case_2:1:b",
            "use_case_2:1:c",
            "use_case_2:4:g",
            "use_case_2:4:f",
            "use_case_3:5:k",
        ]

        assert collection.size == 11
        assert sorted(list(collection.as_tuples())) == sorted(collection_tuples)
        assert sorted(list(collection.as_strings())) == sorted(collection_strings)


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

    def test_merges_with_metadata(self):
        org_id = 1
        cache_mappings = {"cache1": 1, "cache2": 2}
        read_mappings = {"read3": 3, "read4": 4}
        hardcode_mappings = {"hardcode5": 5, "hardcode6": 6}
        write_mappings = {"write7": 7, "write8": 8}
        rate_limited_mappings = {"limited9": None, "limited10": None}

        mappings = {
            *cache_mappings,
            *read_mappings,
            *hardcode_mappings,
            *write_mappings,
            *rate_limited_mappings,
        }

        kr_cache = KeyResults()
        kr_dbread = KeyResults()
        kr_hardcoded = KeyResults()
        kr_write = KeyResults()
        kr_limited = KeyResults()
        assert kr_cache.results == {} and kr_cache.meta == {}
        assert kr_dbread.results == {} and kr_dbread.meta == {}
        assert kr_hardcoded.results == {} and kr_hardcoded.meta == {}
        assert kr_write.results == {} and kr_write.meta == {}
        assert kr_limited.results == {} and kr_limited.meta == {}

        kr_cache.add_key_results(
            [KeyResult(org_id=org_id, string=k, id=v) for k, v in cache_mappings.items()],
            FetchType.CACHE_HIT,
        )
        kr_dbread.add_key_results(
            [KeyResult(org_id=org_id, string=k, id=v) for k, v in read_mappings.items()],
            FetchType.DB_READ,
        )
        kr_hardcoded.add_key_results(
            [KeyResult(org_id=org_id, string=k, id=v) for k, v in hardcode_mappings.items()],
            FetchType.HARDCODED,
        )
        kr_write.add_key_results(
            [KeyResult(org_id=org_id, string=k, id=v) for k, v in write_mappings.items()],
            FetchType.FIRST_SEEN,
        )

        kr_limited.add_key_results(
            [KeyResult(org_id=org_id, string=k, id=v) for k, v in rate_limited_mappings.items()],
            FetchType.RATE_LIMITED,
            FetchTypeExt(is_global=False),
        )

        kr_merged = kr_cache.merge(kr_dbread).merge(kr_hardcoded).merge(kr_write).merge(kr_limited)

        assert len(kr_merged.get_mapped_results()[org_id]) == len(mappings)
        meta = kr_merged.get_fetch_metadata()

        assert_fetch_type_for_tag_string_set(
            meta[org_id], FetchType.DB_READ, set(read_mappings.keys())
        )
        assert_fetch_type_for_tag_string_set(
            meta[org_id], FetchType.HARDCODED, set(hardcode_mappings.keys())
        )
        assert_fetch_type_for_tag_string_set(
            meta[org_id], FetchType.FIRST_SEEN, set(write_mappings.keys())
        )
        assert_fetch_type_for_tag_string_set(
            meta[org_id], FetchType.CACHE_HIT, set(cache_mappings.keys())
        )
        assert_fetch_type_for_tag_string_set(
            meta[org_id], FetchType.RATE_LIMITED, set(rate_limited_mappings.keys())
        )
