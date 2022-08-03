from typing import Mapping, Set

import pytest

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import FetchType, FetchTypeExt, KeyCollection, Metadata
from sentry.sentry_metrics.indexer.cache import indexer_cache
from sentry.sentry_metrics.indexer.models import MetricsKeyIndexer, StringIndexer
from sentry.sentry_metrics.indexer.postgres import PGStringIndexer
from sentry.sentry_metrics.indexer.postgres_v2 import (
    PGStringIndexerV2,
    StaticStringsIndexerDecorator,
)
from sentry.sentry_metrics.indexer.strings import SHARED_STRINGS
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.cache import cache


def assert_fetch_type_for_tag_string_set(
    meta: Mapping[str, Metadata], fetch_type: FetchType, str_set: Set[str]
):
    assert all([meta[string].fetch_type == fetch_type for string in str_set])


pytestmark = pytest.mark.sentry_metrics


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
        self.use_case_id = UseCaseKey("release-health")

    def test_static_strings_only(self) -> None:
        org_strings = {2: {"release"}, 3: {"production", "environment", "release"}}
        results = self.indexer.bulk_record(use_case_id=self.use_case_id, org_strings=org_strings)

        assert results[2]["release"] == SHARED_STRINGS["release"]
        assert results[3]["production"] == SHARED_STRINGS["production"]
        assert results[3]["environment"] == SHARED_STRINGS["environment"]
        assert results[3]["release"] == SHARED_STRINGS["release"]

    def test_static_and_non_static_strings(self):
        org_strings = {
            2: {"release", "1.0.0"},
            3: {"production", "environment", "release", "2.0.0"},
        }
        results = self.indexer.bulk_record(use_case_id=self.use_case_id, org_strings=org_strings)

        v1 = StringIndexer.objects.get(organization_id=2, string="1.0.0")
        v2 = StringIndexer.objects.get(organization_id=3, string="2.0.0")

        assert results[2]["release"] == SHARED_STRINGS["release"]
        assert results[3]["production"] == SHARED_STRINGS["production"]
        assert results[3]["environment"] == SHARED_STRINGS["environment"]
        assert results[3]["release"] == SHARED_STRINGS["release"]

        assert results[2]["1.0.0"] == v1.id
        assert results[3]["2.0.0"] == v2.id

        meta = results.get_fetch_metadata()
        assert_fetch_type_for_tag_string_set(meta[2], FetchType.HARDCODED, {"release"})
        assert_fetch_type_for_tag_string_set(
            meta[3], FetchType.HARDCODED, {"release", "production", "environment"}
        )
        assert_fetch_type_for_tag_string_set(meta[2], FetchType.FIRST_SEEN, {"1.0.0"})
        assert_fetch_type_for_tag_string_set(meta[3], FetchType.FIRST_SEEN, {"2.0.0"})


class PostgresIndexerV2Test(TestCase):
    def setUp(self) -> None:
        self.strings = {"hello", "hey", "hi"}
        self.indexer = PGStringIndexerV2()
        self.org2 = self.create_organization()
        self.use_case_id = UseCaseKey("release-health")
        self.cache_namespace = self.use_case_id.value

    def tearDown(self) -> None:
        cache.clear()

    def test_indexer(self):
        org1_id = self.organization.id
        org2_id = self.org2.id
        org_strings = {org1_id: self.strings, org2_id: {"sup"}}

        # create a record with diff org_id but same string that we test against
        StringIndexer.objects.create(organization_id=999, string="hey")

        assert list(
            indexer_cache.get_many(
                [f"{org1_id}:{string}" for string in self.strings],
                cache_namespace=self.cache_namespace,
            ).values()
        ) == [None, None, None]

        results = self.indexer.bulk_record(
            use_case_id=self.use_case_id, org_strings=org_strings
        ).results

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
            [f"{org1_id}:{string}" for string in self.strings], cache_namespace=self.cache_namespace
        ).values():
            assert cache_value in org1_string_ids

        # verify org2 results and cache values
        assert results[org2_id]["sup"] == org2_string_id
        assert (
            indexer_cache.get(f"{org2_id}:sup", cache_namespace=self.cache_namespace)
            == org2_string_id
        )

        # we should have no results for org_id 999
        assert not results.get(999)

    def test_resolve_and_reverse_resolve(self) -> None:
        """
        Test `resolve` and `reverse_resolve` methods
        """

        org1_id = self.organization.id
        org_strings = {org1_id: self.strings}
        self.indexer.bulk_record(use_case_id=self.use_case_id, org_strings=org_strings)

        # test resolve and reverse_resolve
        obj = StringIndexer.objects.get(string="hello")
        assert (
            self.indexer.resolve(use_case_id=self.use_case_id, org_id=org1_id, string="hello")
            == obj.id
        )
        assert self.indexer.reverse_resolve(use_case_id=self.use_case_id, id=obj.id) == obj.string

        # test record on a string that already exists
        self.indexer.record(use_case_id=self.use_case_id, org_id=org1_id, string="hello")
        assert (
            self.indexer.resolve(use_case_id=self.use_case_id, org_id=org1_id, string="hello")
            == obj.id
        )

        # test invalid values
        assert (
            self.indexer.resolve(use_case_id=self.use_case_id, org_id=org1_id, string="beep")
            is None
        )
        assert self.indexer.reverse_resolve(use_case_id=self.use_case_id, id=1234) is None

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

        results = self.indexer.bulk_record(
            use_case_id=self.use_case_id, org_strings={org_id: {"v1.2.0", "v1.2.1", "v1.2.2"}}
        )
        assert len(results[org_id]) == len(expected_mapping) == 3

        for string, id in results[org_id].items():
            assert expected_mapping[string] == id

        results = self.indexer.bulk_record(
            use_case_id=self.use_case_id,
            org_strings={org_id: {"v1.2.0", "v1.2.1", "v1.2.2", "v1.2.3"}},
        )

        v3 = StringIndexer.objects.get(organization_id=org_id, string="v1.2.3")
        expected_mapping["v1.2.3"] = v3.id

        assert len(results[org_id]) == len(expected_mapping) == 4

        for string, id in results[org_id].items():
            assert expected_mapping[string] == id

        fetch_meta = results.get_fetch_metadata()
        assert_fetch_type_for_tag_string_set(
            fetch_meta[org_id], FetchType.CACHE_HIT, {"v1.2.0", "v1.2.1", "v1.2.2"}
        )
        assert_fetch_type_for_tag_string_set(fetch_meta[org_id], FetchType.FIRST_SEEN, {"v1.2.3"})

    def test_already_cached_plus_read_results(self) -> None:
        """
        Test that we correctly combine cached results with read results
        for the same organization.
        """
        org_id = 8
        cached = {f"{org_id}:beep": 10, f"{org_id}:boop": 11}
        indexer_cache.set_many(cached, self.cache_namespace)

        results = self.indexer.bulk_record(
            use_case_id=self.use_case_id, org_strings={org_id: {"beep", "boop"}}
        )
        assert len(results[org_id]) == 2
        assert results[org_id]["beep"] == 10
        assert results[org_id]["boop"] == 11

        # confirm we did not write to the db if results were already cached
        assert not StringIndexer.objects.filter(organization_id=org_id, string__in=["beep", "boop"])

        bam = StringIndexer.objects.create(organization_id=org_id, string="bam")
        results = self.indexer.bulk_record(
            use_case_id=self.use_case_id, org_strings={org_id: {"beep", "boop", "bam"}}
        )
        assert len(results[org_id]) == 3
        assert results[org_id]["beep"] == 10
        assert results[org_id]["boop"] == 11
        assert results[org_id]["bam"] == bam.id

        fetch_meta = results.get_fetch_metadata()
        assert_fetch_type_for_tag_string_set(
            fetch_meta[org_id], FetchType.CACHE_HIT, {"beep", "boop"}
        )
        assert_fetch_type_for_tag_string_set(fetch_meta[org_id], FetchType.DB_READ, {"bam"})

    def test_get_db_records(self):
        """
        Make sure that calling `_get_db_records` doesn't populate the cache
        """
        string = StringIndexer.objects.create(organization_id=123, string="oop")
        collection = KeyCollection({123: {"oop"}})
        key = "123:oop"

        assert indexer_cache.get(key, self.cache_namespace) is None
        assert indexer_cache.get(string.id, self.cache_namespace) is None

        self.indexer._get_db_records(self.use_case_id, collection)

        assert indexer_cache.get(string.id, self.cache_namespace) is None
        assert indexer_cache.get(key, self.cache_namespace) is None

    def test_rate_limited(self):
        """
        Assert that rate limits per-org and globally are applied at all.

        Since we don't have control over ordering in sets/dicts, we have no
        control over which string gets rate-limited. That makes assertions
        quite awkward and imprecise.
        """
        org_strings = {1: {"a", "b", "c"}, 2: {"e", "f"}, 3: {"g"}}

        with override_options(
            {
                "sentry-metrics.writes-limiter.limits.releasehealth.per-org": [
                    {"window_seconds": 10, "granularity_seconds": 10, "limit": 1}
                ],
            }
        ):
            results = self.indexer.bulk_record(
                use_case_id=self.use_case_id, org_strings=org_strings
            )

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

        org_strings = {1: rate_limited_strings}

        with override_options(
            {
                "sentry-metrics.writes-limiter.limits.releasehealth.global": [
                    {"window_seconds": 10, "granularity_seconds": 10, "limit": 2}
                ],
            }
        ):
            results = self.indexer.bulk_record(
                use_case_id=self.use_case_id, org_strings=org_strings
            )

        rate_limited_strings2 = set()
        for k, v in results[1].items():
            if v is None:
                rate_limited_strings2.add(k)

        assert len(rate_limited_strings2) == 1
        assert len(rate_limited_strings - rate_limited_strings2) == 2
