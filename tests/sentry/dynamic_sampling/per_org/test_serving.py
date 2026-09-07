from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org import cache as per_org_cache
from sentry.dynamic_sampling.per_org.serving import (
    get_organization_sample_rate,
    get_previous_recalibration_factor,
    get_project_sample_rate,
    get_recalibration_factor,
    get_transaction_sample_rates,
)
from sentry.dynamic_sampling.per_org.telemetry import SERVING_SOURCE_METRIC
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature

ORG_ID = 4711
PROJECT_ID = 1234


@pytest.fixture(autouse=True)
def clean_redis() -> Iterator[None]:
    redis = get_redis_client_for_ds()
    keys = [
        per_org_cache.generate_project_sample_rates_cache_key(ORG_ID),
        per_org_cache.generate_transaction_sample_rates_cache_key(ORG_ID, PROJECT_ID),
        per_org_cache.generate_recalibrate_orgs_cache_key(ORG_ID),
        per_org_cache.generate_organization_sample_rate_cache_key(ORG_ID),
    ]
    redis.delete(*keys)
    yield
    redis.delete(*keys)


@pytest.fixture
def emitted_sources() -> Iterator[list[tuple[str, str]]]:
    """The (value, source) tag pairs of every serving source metric emitted."""
    sources: list[tuple[str, str]] = []

    def record(key: str, *args: object, **kwargs: object) -> None:
        if key == SERVING_SOURCE_METRIC:
            tags = kwargs["tags"]
            assert isinstance(tags, dict)
            sources.append((tags["value"], tags["source"]))

    with patch("sentry.dynamic_sampling.per_org.telemetry.metrics.incr", side_effect=record):
        yield sources


def store_project_rate(sample_rate: float = 0.8, project_id: int = PROJECT_ID) -> None:
    per_org_cache.set_project_sample_rates(
        ORG_ID, [RebalancedItem(id=project_id, count=10, new_sample_rate=sample_rate)]
    )


@pytest.mark.django_db
class TestGetProjectSampleRate:
    def test_serves_the_stored_rate(self, emitted_sources: list[tuple[str, str]]) -> None:
        store_project_rate(0.8)

        assert get_project_sample_rate(ORG_ID, PROJECT_ID, error_sample_rate_fallback=0.5) == 0.8
        assert emitted_sources == [("project_sample_rate", "per_org")]

    def test_an_org_without_stored_rates_serves_the_fallback(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        assert get_project_sample_rate(ORG_ID, PROJECT_ID, error_sample_rate_fallback=0.5) == 0.5
        assert emitted_sources == [("project_sample_rate", "per_org_fallback")]

    def test_a_project_the_pass_has_not_reached_is_sampled_in_full(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        # The project was created after the pass, so it had no volume to balance.
        store_project_rate(project_id=PROJECT_ID + 1)

        assert get_project_sample_rate(ORG_ID, PROJECT_ID, error_sample_rate_fallback=0.5) == 1.0
        assert emitted_sources == [("project_sample_rate", "per_org_no_data")]


@pytest.mark.django_db
class TestGetTransactionSampleRates:
    def test_serves_the_stored_rates(self, emitted_sources: list[tuple[str, str]]) -> None:
        per_org_cache.set_transaction_sample_rates(
            ORG_ID,
            {PROJECT_ID: ([RebalancedItem(id="/checkout", count=10, new_sample_rate=0.3)], 0.4)},
        )

        assert get_transaction_sample_rates(ORG_ID, PROJECT_ID, default_rate=1.0) == (
            {"/checkout": 0.3},
            0.4,
        )
        assert emitted_sources == [("transaction_sample_rates", "per_org")]

    def test_a_project_without_stored_rates_samples_at_the_default_rate(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        assert get_transaction_sample_rates(ORG_ID, PROJECT_ID, default_rate=1.0) == ({}, 1.0)
        assert emitted_sources == [("transaction_sample_rates", "per_org_no_data")]

    def test_a_project_balanced_without_named_rates_keeps_its_implicit_rate(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        per_org_cache.set_transaction_sample_rates(ORG_ID, {PROJECT_ID: ([], 0.5)})

        assert get_transaction_sample_rates(ORG_ID, PROJECT_ID, default_rate=1.0) == ({}, 0.5)
        assert emitted_sources == [("transaction_sample_rates", "per_org")]


@pytest.mark.django_db
class TestGetRecalibrationFactor:
    def test_serves_the_stored_factor(self) -> None:
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_recalibration_factor(ORG_ID) == 3.0
        assert get_previous_recalibration_factor(ORG_ID) == 3.0

    def test_a_missing_factor_is_the_identity_factor(self) -> None:
        assert get_recalibration_factor(ORG_ID) == 1.0
        assert get_previous_recalibration_factor(ORG_ID) == 1.0


class GetOrganizationSampleRateTest(TestCase):
    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_custom_dynamic_sampling_targets_the_org_option(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:target_sample_rate", 0.5)

        assert get_organization_sample_rate(org.id, None) == (0.5, True)

    @with_feature(["organizations:dynamic-sampling", "organizations:dynamic-sampling-custom"])
    def test_custom_dynamic_sampling_without_the_option_falls_back(self) -> None:
        org = self.create_organization()

        assert get_organization_sample_rate(org.id, None) == (1.0, False)
        assert get_organization_sample_rate(org.id, 0.7) == (0.7, False)

    def test_serves_the_stored_rate(self) -> None:
        org = self.create_organization()
        self.addCleanup(
            get_redis_client_for_ds().delete,
            per_org_cache.generate_organization_sample_rate_cache_key(org.id),
        )
        per_org_cache.set_organization_sample_rate(org.id, 0.25)

        assert get_organization_sample_rate(org.id, 0.7) == (0.25, True)

    def test_an_org_without_a_stored_rate_falls_back(self) -> None:
        org = self.create_organization()

        assert get_organization_sample_rate(org.id, 0.7) == (0.7, False)

    def test_a_missing_org_falls_back(self) -> None:
        assert get_organization_sample_rate(99999999, 0.7) == (0.7, False)
