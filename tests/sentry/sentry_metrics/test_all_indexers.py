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
from sentry.testutils.helpers.options import override_options

BACKENDS = [
    # TODO: add cloud spanner here
    RawSimpleIndexer,
    pytest.param(PGStringIndexerV2, marks=pytest.mark.django_db),
]


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


use_case_id = UseCaseKey("release-health")


def assert_fetch_type_for_tag_string_set(
    meta: Mapping[str, Metadata], fetch_type: FetchType, str_set: Set[str]
):
    assert all([meta[string].fetch_type == fetch_type for string in str_set])


def test_static_and_non_static_strings(indexer):
    static_indexer = StaticStringIndexer(indexer)
    org_strings = {
        2: {"release", "1.0.0"},
        3: {"production", "environment", "release", "2.0.0"},
    }
    results = static_indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings)

    v1 = indexer.resolve(use_case_id, 2, "1.0.0")
    v2 = indexer.resolve(use_case_id, 3, "2.0.0")

    assert results[2]["release"] == SHARED_STRINGS["release"]
    assert results[3]["production"] == SHARED_STRINGS["production"]
    assert results[3]["environment"] == SHARED_STRINGS["environment"]
    assert results[3]["release"] == SHARED_STRINGS["release"]

    assert results[2]["1.0.0"] == v1
    assert results[3]["2.0.0"] == v2

    meta = results.get_fetch_metadata()
    assert_fetch_type_for_tag_string_set(meta[2], FetchType.HARDCODED, {"release"})
    assert_fetch_type_for_tag_string_set(
        meta[3], FetchType.HARDCODED, {"release", "production", "environment"}
    )
    assert_fetch_type_for_tag_string_set(meta[2], FetchType.FIRST_SEEN, {"1.0.0"})
    assert_fetch_type_for_tag_string_set(meta[3], FetchType.FIRST_SEEN, {"2.0.0"})


def test_indexer(indexer, indexer_cache):
    org1_id = 1
    org2_id = 2
    strings = {"hello", "hey", "hi"}

    raw_indexer = indexer
    indexer = CachingIndexer(indexer_cache, indexer)

    org_strings = {org1_id: strings, org2_id: {"sup"}}

    # create a record with diff org_id but same string that we test against
    indexer.record(use_case_id, 999, "hey")

    assert list(
        indexer_cache.get_many(
            [f"{org1_id}:{string}" for string in strings],
            cache_namespace=use_case_id.value,
        ).values()
    ) == [None, None, None]

    results = indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings).results

    org1_string_ids = {
        raw_indexer.resolve(use_case_id, org1_id, "hello"),
        raw_indexer.resolve(use_case_id, org1_id, "hey"),
        raw_indexer.resolve(use_case_id, org1_id, "hi"),
    }

    assert None not in org1_string_ids
    assert len(org1_string_ids) == 3  # no overlapping ids

    org2_string_id = raw_indexer.resolve(use_case_id, org2_id, "sup")
    assert org2_string_id not in org1_string_ids

    # verify org1 results and cache values
    for value in results[org1_id].values():
        assert value in org1_string_ids

    for cache_value in indexer_cache.get_many(
        [f"{org1_id}:{string}" for string in strings],
        cache_namespace=use_case_id.value,
    ).values():
        assert cache_value in org1_string_ids

    # verify org2 results and cache values
    assert results[org2_id]["sup"] == org2_string_id
    assert indexer_cache.get(f"{org2_id}:sup", cache_namespace=use_case_id.value) == org2_string_id

    # we should have no results for org_id 999
    assert not results.get(999)


def test_resolve_and_reverse_resolve(indexer, indexer_cache):
    """
    Test `resolve` and `reverse_resolve` methods
    """

    org1_id = 1
    strings = {"hello", "hey", "hi"}

    indexer = CachingIndexer(indexer_cache, indexer)

    org_strings = {org1_id: strings}
    indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings)

    # test resolve and reverse_resolve
    id = indexer.resolve(use_case_id=use_case_id, org_id=org1_id, string="hello")
    assert id is not None
    assert indexer.reverse_resolve(use_case_id=use_case_id, org_id=org1_id, id=id) == "hello"

    # test record on a string that already exists
    indexer.record(use_case_id=use_case_id, org_id=org1_id, string="hello")
    assert indexer.resolve(use_case_id=use_case_id, org_id=org1_id, string="hello") == id

    # test invalid values
    assert indexer.resolve(use_case_id=use_case_id, org_id=org1_id, string="beep") is None
    assert indexer.reverse_resolve(use_case_id=use_case_id, org_id=org1_id, id=1234) is None


def test_already_created_plus_written_results(indexer, indexer_cache) -> None:
    """
    Test that we correctly combine db read results with db write results
    for the same organization.
    """
    org_id = 1234

    raw_indexer = indexer
    indexer = CachingIndexer(indexer_cache, indexer)

    v0 = raw_indexer.record(use_case_id, org_id, "v1.2.0")
    v1 = raw_indexer.record(use_case_id, org_id, "v1.2.1")
    v2 = raw_indexer.record(use_case_id, org_id, "v1.2.2")

    expected_mapping = {"v1.2.0": v0, "v1.2.1": v1, "v1.2.2": v2}

    results = indexer.bulk_record(
        use_case_id=use_case_id, org_strings={org_id: {"v1.2.0", "v1.2.1", "v1.2.2"}}
    )
    assert len(results[org_id]) == len(expected_mapping) == 3

    for string, id in results[org_id].items():
        assert expected_mapping[string] == id

    results = indexer.bulk_record(
        use_case_id=use_case_id,
        org_strings={org_id: {"v1.2.0", "v1.2.1", "v1.2.2", "v1.2.3"}},
    )
    v3 = raw_indexer.resolve(use_case_id, org_id, "v1.2.3")
    expected_mapping["v1.2.3"] = v3

    assert len(results[org_id]) == len(expected_mapping) == 4

    for string, id in results[org_id].items():
        assert expected_mapping[string] == id

    fetch_meta = results.get_fetch_metadata()
    assert_fetch_type_for_tag_string_set(
        fetch_meta[org_id], FetchType.CACHE_HIT, {"v1.2.0", "v1.2.1", "v1.2.2"}
    )
    assert_fetch_type_for_tag_string_set(fetch_meta[org_id], FetchType.FIRST_SEEN, {"v1.2.3"})


def test_already_cached_plus_read_results(indexer, indexer_cache) -> None:
    """
    Test that we correctly combine cached results with read results
    for the same organization.
    """
    org_id = 8
    cached = {f"{org_id}:beep": 10, f"{org_id}:boop": 11}
    indexer_cache.set_many(cached, use_case_id.value)

    raw_indexer = indexer
    indexer = CachingIndexer(indexer_cache, indexer)

    results = indexer.bulk_record(use_case_id=use_case_id, org_strings={org_id: {"beep", "boop"}})
    assert len(results[org_id]) == 2
    assert results[org_id]["beep"] == 10
    assert results[org_id]["boop"] == 11

    # confirm we did not write to the db if results were already cached
    assert not raw_indexer.resolve(use_case_id, org_id, "beep")
    assert not raw_indexer.resolve(use_case_id, org_id, "boop")

    bam = raw_indexer.record(use_case_id, org_id, "bam")
    assert bam is not None

    results = indexer.bulk_record(
        use_case_id=use_case_id, org_strings={org_id: {"beep", "boop", "bam"}}
    )
    assert len(results[org_id]) == 3
    assert results[org_id]["beep"] == 10
    assert results[org_id]["boop"] == 11
    assert results[org_id]["bam"] == bam

    fetch_meta = results.get_fetch_metadata()
    assert_fetch_type_for_tag_string_set(fetch_meta[org_id], FetchType.CACHE_HIT, {"beep", "boop"})
    assert_fetch_type_for_tag_string_set(fetch_meta[org_id], FetchType.DB_READ, {"bam"})


def test_rate_limited(indexer):
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
            "sentry-metrics.writes-limiter.limits.releasehealth.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 1}
            ],
        }
    ):
        results = indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings)

    assert len(results[1]) == 3
    assert len(results[2]) == 2
    assert len(results[3]) == 1
    assert results[3]["g"] is not None

    rate_limited_strings = set()

    for org_id in 1, 2, 3:
        for k, v in results[org_id].items():
            if v is None:
                rate_limited_strings.add((org_id, k))

    assert len(rate_limited_strings) == 3
    assert (3, "g") not in rate_limited_strings

    for org_id, string in rate_limited_strings:
        assert results.get_fetch_metadata()[org_id][string] == Metadata(
            id=None,
            fetch_type=FetchType.RATE_LIMITED,
            fetch_type_ext=FetchTypeExt(is_global=False),
        )

    org_strings = {1: {"x", "y", "z"}}

    # attempt to index even more strings, and assert that we can't get any indexed
    with override_options(
        {
            "sentry-metrics.writes-limiter.limits.releasehealth.per-org": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 1}
            ],
        }
    ):
        results = indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings)

    assert results[1] == {"x": None, "y": None, "z": None}
    for letter in "xyz":
        assert results.get_fetch_metadata()[1][letter] == Metadata(
            id=None,
            fetch_type=FetchType.RATE_LIMITED,
            fetch_type_ext=FetchTypeExt(is_global=False),
        )

    org_strings = {1: rate_limited_strings}

    # assert that if we reconfigure limits, the quota resets
    with override_options(
        {
            "sentry-metrics.writes-limiter.limits.releasehealth.global": [
                {"window_seconds": 10, "granularity_seconds": 10, "limit": 2}
            ],
        }
    ):
        results = indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings)

    rate_limited_strings2 = set()
    for k, v in results[1].items():
        if v is None:
            rate_limited_strings2.add(k)

    assert len(rate_limited_strings2) == 1
    assert len(rate_limited_strings - rate_limited_strings2) == 2
