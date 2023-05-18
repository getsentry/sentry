"""
Generic testsuite that runs against all productionized indexer backends.

Tests static string indexer, caching string indexer in combination, plugs in
various backends to see if their external behavior makes sense, and that e.g.
the mock indexer actually behaves the same as the postgres indexer.
"""

from typing import Mapping, Set

import pytest

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import FetchType, FetchTypeExt, Metadata
from sentry.sentry_metrics.indexer.cache import CachingIndexer, StringIndexerCache
from sentry.sentry_metrics.indexer.mock import RawSimpleIndexer
from sentry.sentry_metrics.indexer.postgres.postgres_v2 import PGStringIndexerV2
from sentry.sentry_metrics.indexer.strings import SHARED_STRINGS, StaticStringIndexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.helpers.options import override_options

BACKENDS = [
    RawSimpleIndexer,
    pytest.param(PGStringIndexerV2, marks=pytest.mark.django_db),
]

USE_CASE_IDS = [UseCaseID.SESSIONS, UseCaseID.TRANSACTIONS]


@pytest.fixture(params=BACKENDS)
def indexer_cls(request):
    return request.param


@pytest.fixture
def indexer(indexer_cls):
    return indexer_cls()


@pytest.fixture
def indexer_cache():
    indexer_cache = StringIndexerCache(
        cache_name="default",
        partition_key="test",
    )

    yield indexer_cache

    indexer_cache.cache.clear()


@pytest.fixture(params=USE_CASE_IDS)
def use_case_id(request):
    return request.param


@pytest.fixture
def use_case_key(use_case_id):
    if use_case_id is UseCaseID.SESSIONS:
        return UseCaseKey.RELEASE_HEALTH
    return UseCaseKey.PERFORMANCE


@pytest.fixture
def writes_limiter_option_name(use_case_key):
    if use_case_key is UseCaseKey.RELEASE_HEALTH:
        return "sentry-metrics.writes-limiter.limits.releasehealth"
    return "sentry-metrics.writes-limiter.limits.performance"


def assert_fetch_type_for_tag_string_set(
    meta: Mapping[str, Metadata], fetch_type: FetchType, str_set: Set[str]
):
    assert all([meta[string].fetch_type == fetch_type for string in str_set])


def test_static_and_non_static_strings_release_health(indexer, use_case_id, use_case_key):
    static_indexer = StaticStringIndexer(indexer)
    strings = {
        use_case_id: {
            2: {"release", "1.0.0"},
            3: {"production", "environment", "release", "2.0.0"},
        }
    }
    results = static_indexer.bulk_record(strings=strings)

    v1 = indexer.resolve(use_case_key, 2, "1.0.0")
    v2 = indexer.resolve(use_case_key, 3, "2.0.0")

    assert results[use_case_id][2]["release"] == SHARED_STRINGS["release"]
    assert results[use_case_id][3]["production"] == SHARED_STRINGS["production"]
    assert results[use_case_id][3]["environment"] == SHARED_STRINGS["environment"]
    assert results[use_case_id][3]["release"] == SHARED_STRINGS["release"]

    assert results[use_case_id][2]["1.0.0"] == v1
    assert results[use_case_id][3]["2.0.0"] == v2

    meta = results.get_fetch_metadata()
    assert_fetch_type_for_tag_string_set(meta[use_case_id][2], FetchType.HARDCODED, {"release"})
    assert_fetch_type_for_tag_string_set(
        meta[use_case_id][3], FetchType.HARDCODED, {"release", "production", "environment"}
    )
    assert_fetch_type_for_tag_string_set(meta[use_case_id][2], FetchType.FIRST_SEEN, {"1.0.0"})
    assert_fetch_type_for_tag_string_set(meta[use_case_id][3], FetchType.FIRST_SEEN, {"2.0.0"})


def test_static_and_non_static_strings_generic_metrics(indexer):
    static_indexer = StaticStringIndexer(indexer)
    strings = {
        UseCaseID.SPANS: {
            2: {"release", "AAA"},
            3: {"production", "environment", "release", "AAA", "BBB"},
        },
        UseCaseID.TRANSACTIONS: {
            1: {"production", "environment", "BBB", "CCC"},
            2: {"AAA", "1.0.0"},
        },
    }
    with override_options(
        {
            "sentry-metrics.writes-limiter.limits.spans.global": [],
            "sentry-metrics.writes-limiter.limits.spans.per-org": [],
        },
    ):
        results = static_indexer.bulk_record(strings=strings)

    transac_1_bbb = indexer.resolve(UseCaseKey.PERFORMANCE, 1, "BBB")
    transac_1_ccc = indexer.resolve(UseCaseKey.PERFORMANCE, 1, "CCC")
    # Requires use case aware resolve
    # transac_2_aaa = indexer.resolve(UseCaseKey.PERFORMANCE, 2, "AAA")

    assert results[UseCaseID.SPANS][2]["release"] == SHARED_STRINGS["release"]
    assert results[UseCaseID.SPANS][3]["production"] == SHARED_STRINGS["production"]
    assert results[UseCaseID.SPANS][3]["environment"] == SHARED_STRINGS["environment"]
    assert results[UseCaseID.SPANS][3]["release"] == SHARED_STRINGS["release"]

    assert results[UseCaseID.TRANSACTIONS][1]["production"] == SHARED_STRINGS["production"]
    assert results[UseCaseID.TRANSACTIONS][1]["environment"] == SHARED_STRINGS["environment"]

    assert results[UseCaseID.TRANSACTIONS][1]["BBB"] == transac_1_bbb
    assert results[UseCaseID.TRANSACTIONS][1]["CCC"] == transac_1_ccc
    # Requires use case aware resolve
    # assert results[UseCaseID.TRANSACTIONS][2]["AAA"] == transac_2_aaa

    meta = results.get_fetch_metadata()
    assert_fetch_type_for_tag_string_set(meta[UseCaseID.SPANS][2], FetchType.HARDCODED, {"release"})
    assert_fetch_type_for_tag_string_set(
        meta[UseCaseID.SPANS][3], FetchType.HARDCODED, {"release", "production", "environment"}
    )
    assert_fetch_type_for_tag_string_set(
        meta[UseCaseID.TRANSACTIONS][1], FetchType.HARDCODED, {"production", "environment"}
    )
    assert_fetch_type_for_tag_string_set(
        meta[UseCaseID.TRANSACTIONS][2],
        FetchType.HARDCODED,
        {},
    )
    assert_fetch_type_for_tag_string_set(meta[UseCaseID.SPANS][2], FetchType.FIRST_SEEN, {"AAA"})
    assert_fetch_type_for_tag_string_set(
        meta[UseCaseID.SPANS][3], FetchType.FIRST_SEEN, {"AAA", "BBB"}
    )
    assert_fetch_type_for_tag_string_set(
        meta[UseCaseID.TRANSACTIONS][1], FetchType.FIRST_SEEN, {"BBB"}
    )
    assert_fetch_type_for_tag_string_set(
        meta[UseCaseID.TRANSACTIONS][2], FetchType.FIRST_SEEN, {"AAA"}
    )


def test_indexer(indexer, indexer_cache, use_case_id, use_case_key):
    org1_id = 1
    org2_id = 2
    strings = {"hello", "hey", "hi"}

    raw_indexer = indexer
    indexer = CachingIndexer(indexer_cache, indexer)

    use_case_strings = {use_case_id: {org1_id: strings, org2_id: {"sup"}}}

    # create a record with diff org_id but same string that we test against
    indexer.record(use_case_id, 999, "hey")

    assert list(
        indexer_cache.get_many(
            [f"{use_case_id}:{org1_id}:{string}" for string in strings],
        ).values()
    ) == [None, None, None]

    results = indexer.bulk_record(use_case_strings).results

    org1_string_ids = {
        raw_indexer.resolve(use_case_key, org1_id, "hello"),
        raw_indexer.resolve(use_case_key, org1_id, "hey"),
        raw_indexer.resolve(use_case_key, org1_id, "hi"),
    }

    assert None not in org1_string_ids
    assert len(org1_string_ids) == 3  # no overlapping ids

    org2_string_id = raw_indexer.resolve(use_case_key, org2_id, "sup")
    assert org2_string_id not in org1_string_ids

    # verify org1 results and cache values
    for id_value in results[use_case_id].results[org1_id].values():
        assert id_value in org1_string_ids

    for cache_value in indexer_cache.get_many(
        [f"{use_case_id.value}:{org1_id}:{string}" for string in strings]
    ).values():
        assert cache_value in org1_string_ids

    # verify org2 results and cache values
    assert results[use_case_id][org2_id]["sup"] == org2_string_id
    assert indexer_cache.get(f"{use_case_id.value}:{org2_id}:sup") == org2_string_id

    # we should have no results for org_id 999
    assert not results[use_case_id].results.get(999)


def test_resolve_and_reverse_resolve(indexer, indexer_cache, use_case_id, use_case_key):
    """
    Test `resolve` and `reverse_resolve` methods
    """

    org1_id = 1
    strings = {"hello", "hey", "hi"}

    indexer = CachingIndexer(indexer_cache, indexer)

    org_strings = {org1_id: strings}
    indexer.bulk_record({use_case_id: org_strings})

    # test resolve and reverse_resolve
    id = indexer.resolve(use_case_id=use_case_key, org_id=org1_id, string="hello")
    assert id is not None
    assert indexer.reverse_resolve(use_case_id=use_case_key, org_id=org1_id, id=id) == "hello"

    # test record on a string that already exists
    indexer.record(use_case_id=use_case_id, org_id=org1_id, string="hello")
    assert indexer.resolve(use_case_id=use_case_key, org_id=org1_id, string="hello") == id

    # test invalid values
    assert indexer.resolve(use_case_id=use_case_key, org_id=org1_id, string="beep") is None
    assert indexer.reverse_resolve(use_case_id=use_case_key, org_id=org1_id, id=1234) is None


def test_already_created_plus_written_results(
    indexer, indexer_cache, use_case_id, use_case_key
) -> None:
    """
    Test that we correctly combine db read results with db write results
    for the same organization.
    """
    org_id = 1234

    raw_indexer = indexer
    indexer = CachingIndexer(indexer_cache, indexer)

    v0 = raw_indexer.record(use_case_id, org_id, "v1.2.0:xyz")
    v1 = raw_indexer.record(use_case_id, org_id, "v1.2.1:xyz")
    v2 = raw_indexer.record(use_case_id, org_id, "v1.2.2:xyz")

    expected_mapping = {"v1.2.0:xyz": v0, "v1.2.1:xyz": v1, "v1.2.2:xyz": v2}

    results = indexer.bulk_record(
        {use_case_id: {org_id: {"v1.2.0:xyz", "v1.2.1:xyz", "v1.2.2:xyz"}}}
    )
    assert len(results[use_case_id][org_id]) == len(expected_mapping) == 3

    for string, id in results[use_case_id][org_id].items():
        assert expected_mapping[string] == id

    results = indexer.bulk_record(
        {use_case_id: {org_id: {"v1.2.0:xyz", "v1.2.1:xyz", "v1.2.2:xyz", "v1.2.3:xyz"}}},
    )
    v3 = raw_indexer.resolve(use_case_key, org_id, "v1.2.3:xyz")
    expected_mapping["v1.2.3:xyz"] = v3

    assert len(results[use_case_id][org_id]) == len(expected_mapping) == 4

    for string, id in results[use_case_id][org_id].items():
        assert expected_mapping[string] == id

    fetch_meta = results.get_fetch_metadata()
    assert_fetch_type_for_tag_string_set(
        fetch_meta[use_case_id][org_id],
        FetchType.CACHE_HIT,
        {"v1.2.0:xyz", "v1.2.1:xyz", "v1.2.2:xyz"},
    )
    assert_fetch_type_for_tag_string_set(
        fetch_meta[use_case_id][org_id], FetchType.FIRST_SEEN, {"v1.2.3:xyz"}
    )


def test_already_cached_plus_read_results(
    indexer, indexer_cache, use_case_id, use_case_key
) -> None:
    """
    Test that we correctly combine cached results with read results
    for the same organization.
    """
    org_id = 8
    cached = {f"{use_case_id.value}:{org_id}:beep": 10, f"{use_case_id.value}:{org_id}:boop": 11}
    indexer_cache.set_many(cached)

    raw_indexer = indexer
    indexer = CachingIndexer(indexer_cache, indexer)

    results = indexer.bulk_record({use_case_id: {org_id: {"beep", "boop"}}})
    assert len(results[use_case_id][org_id]) == 2
    assert results[use_case_id][org_id]["beep"] == 10
    assert results[use_case_id][org_id]["boop"] == 11

    # confirm we did not write to the db if results were already cached
    assert not raw_indexer.resolve(use_case_key, org_id, "beep")
    assert not raw_indexer.resolve(use_case_key, org_id, "boop")

    bam = raw_indexer.record(use_case_id, org_id, "bam")
    assert bam is not None

    results = indexer.bulk_record({use_case_id: {org_id: {"beep", "boop", "bam"}}})
    assert len(results[use_case_id][org_id]) == 3
    assert results[use_case_id][org_id]["beep"] == 10
    assert results[use_case_id][org_id]["boop"] == 11
    assert results[use_case_id][org_id]["bam"] == bam

    fetch_meta = results.get_fetch_metadata()
    assert_fetch_type_for_tag_string_set(
        fetch_meta[use_case_id][org_id], FetchType.CACHE_HIT, {"beep", "boop"}
    )
    assert_fetch_type_for_tag_string_set(
        fetch_meta[use_case_id][org_id], FetchType.DB_READ, {"bam"}
    )


def test_read_when_bulk_record(indexer, use_case_id):
    strings = {
        use_case_id: {
            1: {"a"},
            2: {"b", "c"},
            3: {"d", "e", "f"},
            4: {"g", "h", "i", "j"},
            5: {"k", "l", "m", "n", "o"},
        }
    }
    indexer.bulk_record(strings)
    results = indexer.bulk_record(strings)
    assert all(
        str_meta_data.fetch_type is FetchType.DB_READ
        for key_result in results.results.values()
        for metadata in key_result.meta.values()
        for str_meta_data in metadata.values()
    )


def test_rate_limited(indexer, use_case_id, writes_limiter_option_name):
    """
    Assert that rate limits per-org and globally are applied at all.

    Since we don't have control over ordering in sets/dicts, we have no
    control over which string gets rate-limited. That makes assertions
    quite awkward and imprecise.
    """
    if isinstance(indexer, RawSimpleIndexer):
        pytest.skip("mock indexer does not support rate limiting")

    org_strings = {1: {"a", "b", "c"}, 2: {"e", "f"}, 3: {"g"}}

    with override_options(
        {
            f"{writes_limiter_option_name}.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 1}
            ],
        }
    ):
        results = indexer.bulk_record({use_case_id: org_strings})

    assert len(results[use_case_id][1]) == 3
    assert len(results[use_case_id][2]) == 2
    assert len(results[use_case_id][3]) == 1
    assert results[use_case_id][3]["g"] is not None

    rate_limited_strings = set()

    for org_id in 1, 2, 3:
        for k, v in results[use_case_id][org_id].items():
            if v is None:
                rate_limited_strings.add((org_id, k))

    assert len(rate_limited_strings) == 3
    assert (3, "g") not in rate_limited_strings

    for org_id, string in rate_limited_strings:
        assert results.get_fetch_metadata()[use_case_id][org_id][string] == Metadata(
            id=None,
            fetch_type=FetchType.RATE_LIMITED,
            fetch_type_ext=FetchTypeExt(is_global=False),
        )

    org_strings = {1: {"x", "y", "z"}}

    # attempt to index even more strings, and assert that we can't get any indexed
    with override_options(
        {
            f"{writes_limiter_option_name}.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 1}
            ],
        }
    ):
        results = indexer.bulk_record({use_case_id: org_strings})

    assert results[use_case_id][1] == {"x": None, "y": None, "z": None}
    for letter in "xyz":
        assert results.get_fetch_metadata()[use_case_id][1][letter] == Metadata(
            id=None,
            fetch_type=FetchType.RATE_LIMITED,
            fetch_type_ext=FetchTypeExt(is_global=False),
        )

    org_strings = {1: rate_limited_strings}

    # assert that if we reconfigure limits, the quota resets
    with override_options(
        {
            f"{writes_limiter_option_name}.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 2}
            ],
        }
    ):
        results = indexer.bulk_record({use_case_id: org_strings})

    rate_limited_strings2 = set()
    for k, v in results[use_case_id][1].items():
        if v is None:
            rate_limited_strings2.add(k)

    assert len(rate_limited_strings2) == 1
    assert len(rate_limited_strings - rate_limited_strings2) == 2
