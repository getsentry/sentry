from collections import defaultdict
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
    UseCaseResult,
    UseCaseResults,
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


class UseCaseResultsTest(TestCase):
    def test_basic(self) -> None:
        use_case_results = UseCaseResults()

        assert use_case_results.results == {}
        assert use_case_results.get_mapped_results() == {}
        assert use_case_results.get_mapped_strings_to_ints() == {}

        use_case_collection = UseCaseCollection(
            {
                "uc_1": {1: {"a", "b", "c"}, 2: {"e", "f"}},
                "uc_2": {1: {"a", "j"}},
                "uc_3": {5: {"a", "c"}},
            }
        )
        assert use_case_results.get_unmapped_use_cases(use_case_collection) == use_case_collection
        results_with_meta = [
            (
                [
                    UseCaseResult(use_case_id="uc_1", org_id=1, string="a", id=1),
                ],
                None,
            ),
            (
                [
                    UseCaseResult(use_case_id="uc_1", org_id=1, string="c", id=2),
                    UseCaseResult(use_case_id="uc_2", org_id=1, string="a", id=3),
                    UseCaseResult(use_case_id="uc_2", org_id=1, string="j", id=4),
                ],
                FetchType.CACHE_HIT,
            ),
            (
                [
                    UseCaseResult(use_case_id="uc_4", org_id=2, string="j", id=5),
                ],
                FetchType.FIRST_SEEN,
            ),
        ]
        for results, meta in results_with_meta:
            use_case_results.add_use_case_results(results, meta)

        assert use_case_results.get_mapped_results() == {
            "uc_1": {1: {"a": 1, "c": 2}},
            "uc_2": {1: {"a": 3, "j": 4}},
            "uc_4": {2: {"j": 5}},
        }
        assert use_case_results.get_fetch_metadata() == {
            "uc_1": defaultdict(dict, {1: {"c": Metadata(id=2, fetch_type=FetchType.CACHE_HIT)}}),
            "uc_2": defaultdict(
                dict,
                {
                    1: {
                        "a": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                        "j": Metadata(id=4, fetch_type=FetchType.CACHE_HIT),
                    }
                },
            ),
            "uc_4": defaultdict(dict, {2: {"j": Metadata(id=5, fetch_type=FetchType.FIRST_SEEN)}}),
        }
        assert use_case_results.get_unmapped_use_cases(use_case_collection) == UseCaseCollection(
            {
                "uc_1": {1: {"b"}, 2: {"e", "f"}},
                "uc_3": {5: {"a", "c"}},
            }
        )
        assert use_case_results.get_mapped_strings_to_ints() == {
            "uc_1:1:a": 1,
            "uc_1:1:c": 2,
            "uc_2:1:a": 3,
            "uc_2:1:j": 4,
            "uc_4:2:j": 5,
        }

    def test_merge(self) -> None:
        use_case_results_1 = UseCaseResults()
        use_case_results_2 = UseCaseResults()
        assert (
            use_case_results_1.merge(UseCaseResults()).merge(UseCaseResults()) == UseCaseResults()
        )
        results_with_meta_1 = [
            (
                [
                    UseCaseResult(use_case_id="uc_1", org_id=1, string="a", id=1),
                ],
                None,
            ),
            (
                [
                    UseCaseResult(use_case_id="uc_1", org_id=1, string="c", id=2),
                    UseCaseResult(use_case_id="uc_2", org_id=1, string="a", id=3),
                    UseCaseResult(use_case_id="uc_3", org_id=1, string="e", id=4),
                ],
                FetchType.CACHE_HIT,
            ),
            (
                [
                    UseCaseResult(use_case_id="uc_3", org_id=2, string="e", id=5),
                ],
                FetchType.FIRST_SEEN,
            ),
        ]
        results_with_meta_2 = [
            (
                [
                    UseCaseResult(use_case_id="uc_1", org_id=1, string="a", id=1),
                ],
                None,
            ),
            (
                [
                    UseCaseResult(use_case_id="uc_1", org_id=1, string="c", id=2),
                    UseCaseResult(use_case_id="uc_1", org_id=1, string="d", id=3),
                    UseCaseResult(use_case_id="uc_2", org_id=2, string="a", id=4),
                    UseCaseResult(use_case_id="uc_4", org_id=1, string="e", id=5),
                ],
                FetchType.CACHE_HIT,
            ),
            (
                [
                    UseCaseResult(use_case_id="uc_3", org_id=2, string="e", id=5),
                ],
                FetchType.FIRST_SEEN,
            ),
        ]
        for results, meta in results_with_meta_1:
            use_case_results_1.add_use_case_results(results, meta)
        assert (
            use_case_results_1.merge(UseCaseResults()).merge(UseCaseResults()) == use_case_results_1
        )
        assert (
            UseCaseResults().merge(UseCaseResults()).merge(use_case_results_1) == use_case_results_1
        )
        for results, meta in results_with_meta_2:
            use_case_results_2.add_use_case_results(results, meta)
        assert use_case_results_1.merge(use_case_results_2) == use_case_results_2.merge(
            use_case_results_1
        )
        assert use_case_results_1.merge(use_case_results_2).get_mapped_results() == {
            "uc_1": {1: {"a": 1, "c": 2, "d": 3}},
            "uc_2": {1: {"a": 3}, 2: {"a": 4}},
            "uc_3": {1: {"e": 4}, 2: {"e": 5}},
            "uc_4": {1: {"e": 5}},
        }
        assert use_case_results_1.merge(use_case_results_2).get_fetch_metadata() == {
            "uc_1": defaultdict(
                dict,
                {
                    1: {
                        "c": Metadata(id=2, fetch_type=FetchType.CACHE_HIT),
                        "d": Metadata(id=3, fetch_type=FetchType.CACHE_HIT),
                    }
                },
            ),
            "uc_2": defaultdict(
                dict,
                {
                    1: {"a": Metadata(id=3, fetch_type=FetchType.CACHE_HIT)},
                    2: {"a": Metadata(id=4, fetch_type=FetchType.CACHE_HIT)},
                },
            ),
            "uc_3": defaultdict(
                dict,
                {
                    1: {"e": Metadata(id=4, fetch_type=FetchType.CACHE_HIT)},
                    2: {"e": Metadata(id=5, fetch_type=FetchType.FIRST_SEEN)},
                },
            ),
            "uc_4": defaultdict(dict, {1: {"e": Metadata(id=5, fetch_type=FetchType.CACHE_HIT)}}),
        }
