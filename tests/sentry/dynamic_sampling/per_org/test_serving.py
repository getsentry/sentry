from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import patch

import pytest

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org import cache as per_org_cache
from sentry.dynamic_sampling.per_org.serving import (
    get_previous_recalibration_factor,
    get_project_sample_rate,
    get_recalibration_factor,
    get_transaction_sample_rates,
    is_recalibration_factor_served_per_org,
)
from sentry.dynamic_sampling.per_org.telemetry import SERVING_SOURCE_METRIC
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers import recalibrate_orgs as legacy_recalibration_cache
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    set_transactions_resampling_rates,
)
from sentry.testutils.helpers.options import override_options

ORG_ID = 4711
PROJECT_ID = 1234

SERVING_ON = {"dynamic-sampling.per_org.serving-rollout-rate": 1.0}
SERVING_OFF = {"dynamic-sampling.per_org.serving-rollout-rate": 0.0}
SERVING_BY_ORG_ID = {
    "dynamic-sampling.per_org.serving-rollout-rate": 0.0,
    "dynamic-sampling.per_org.serving-org-ids": [ORG_ID],
}


@pytest.fixture(autouse=True)
def clean_redis() -> Iterator[None]:
    redis = get_redis_client_for_ds()
    keys = [
        per_org_cache.generate_project_sample_rates_cache_key(ORG_ID),
        per_org_cache.generate_transaction_sample_rates_cache_key(ORG_ID, PROJECT_ID),
        per_org_cache.generate_recalibrate_orgs_cache_key(ORG_ID),
        legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(ORG_ID),
        generate_boost_low_volume_projects_cache_key(ORG_ID),
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


def store_legacy_project_sample_rate(sample_rate: float) -> None:
    get_redis_client_for_ds().hset(
        generate_boost_low_volume_projects_cache_key(ORG_ID), str(PROJECT_ID), sample_rate
    )


def switch_org_to_per_org(sample_rate: float = 0.8, project_id: int = PROJECT_ID) -> None:
    """Store the project rates that move the organization onto the per-org caches."""
    per_org_cache.set_project_sample_rates(
        ORG_ID, [RebalancedItem(id=project_id, count=10, new_sample_rate=sample_rate)]
    )


@pytest.mark.django_db
class TestGetProjectSampleRate:
    @override_options(SERVING_OFF)
    def test_serves_the_legacy_cache_outside_the_rollout(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        store_legacy_project_sample_rate(0.2)
        per_org_cache.set_project_sample_rates(
            ORG_ID, [RebalancedItem(id=PROJECT_ID, count=10, new_sample_rate=0.8)]
        )

        assert get_project_sample_rate(ORG_ID, PROJECT_ID, error_sample_rate_fallback=1.0) == 0.2
        assert emitted_sources == [("project_sample_rate", "legacy")]

    @override_options(SERVING_ON)
    def test_serves_the_per_org_cache_inside_the_rollout(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        store_legacy_project_sample_rate(0.2)
        per_org_cache.set_project_sample_rates(
            ORG_ID, [RebalancedItem(id=PROJECT_ID, count=10, new_sample_rate=0.8)]
        )

        assert get_project_sample_rate(ORG_ID, PROJECT_ID, error_sample_rate_fallback=1.0) == 0.8
        assert emitted_sources == [("project_sample_rate", "per_org")]

    @override_options(SERVING_ON)
    def test_an_org_without_stored_rates_still_serves_the_legacy_cache(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        store_legacy_project_sample_rate(0.2)

        assert get_project_sample_rate(ORG_ID, PROJECT_ID, error_sample_rate_fallback=1.0) == 0.2
        assert emitted_sources == [("project_sample_rate", "per_org_fallback")]

    @override_options(SERVING_ON)
    def test_a_project_the_pass_has_not_reached_is_sampled_in_full(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        store_legacy_project_sample_rate(0.2)
        # The organization switched over, but this project was created after the pass, so
        # its rate must not be borrowed back from the legacy cache.
        switch_org_to_per_org(project_id=PROJECT_ID + 1)

        assert get_project_sample_rate(ORG_ID, PROJECT_ID, error_sample_rate_fallback=0.5) == 1.0
        assert emitted_sources == [("project_sample_rate", "per_org_no_data")]

    @override_options({**SERVING_ON, "dynamic-sampling.per_org.killswitch": True})
    def test_the_killswitch_serves_the_legacy_cache(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        store_legacy_project_sample_rate(0.2)
        per_org_cache.set_project_sample_rates(
            ORG_ID, [RebalancedItem(id=PROJECT_ID, count=10, new_sample_rate=0.8)]
        )

        assert get_project_sample_rate(ORG_ID, PROJECT_ID, error_sample_rate_fallback=1.0) == 0.2
        assert emitted_sources == [("project_sample_rate", "legacy")]


@pytest.mark.django_db
class TestGetTransactionSampleRates:
    def store_legacy_rates(self) -> None:
        set_transactions_resampling_rates(
            org_id=ORG_ID,
            proj_id=PROJECT_ID,
            named_rates=[RebalancedItem(id="/legacy", count=10, new_sample_rate=0.1)],
            default_rate=0.2,
            ttl_ms=60_000,
        )

    def store_per_org_rates(self) -> None:
        per_org_cache.set_transaction_sample_rates(
            ORG_ID,
            {PROJECT_ID: ([RebalancedItem(id="/per_org", count=10, new_sample_rate=0.3)], 0.4)},
        )

    @override_options(SERVING_OFF)
    def test_serves_the_legacy_cache_outside_the_rollout(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        self.store_legacy_rates()
        self.store_per_org_rates()

        assert get_transaction_sample_rates(ORG_ID, PROJECT_ID, default_rate=1.0) == (
            {"/legacy": 0.1},
            0.2,
        )
        assert emitted_sources == [("transaction_sample_rates", "legacy")]

    @override_options(SERVING_ON)
    def test_serves_the_per_org_cache_inside_the_rollout(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        self.store_legacy_rates()
        switch_org_to_per_org()
        self.store_per_org_rates()

        assert get_transaction_sample_rates(ORG_ID, PROJECT_ID, default_rate=1.0) == (
            {"/per_org": 0.3},
            0.4,
        )
        assert emitted_sources == [("transaction_sample_rates", "per_org")]

    @override_options(SERVING_ON)
    def test_an_org_without_stored_rates_still_serves_the_legacy_cache(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        self.store_legacy_rates()
        self.store_per_org_rates()

        assert get_transaction_sample_rates(ORG_ID, PROJECT_ID, default_rate=1.0) == (
            {"/legacy": 0.1},
            0.2,
        )
        assert emitted_sources == [("transaction_sample_rates", "per_org_fallback")]

    @override_options(SERVING_ON)
    def test_a_switched_org_never_reads_the_legacy_transaction_rates(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        self.store_legacy_rates()
        switch_org_to_per_org()

        # The pass balanced no transaction for this project, so it has no per-transaction
        # rules. Borrowing the legacy ones would mix two budgets.
        assert get_transaction_sample_rates(ORG_ID, PROJECT_ID, default_rate=1.0) == ({}, 1.0)
        assert emitted_sources == [("transaction_sample_rates", "per_org")]

    @override_options(SERVING_ON)
    def test_a_project_balanced_without_named_rates_keeps_its_implicit_rate(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        self.store_legacy_rates()
        switch_org_to_per_org()
        per_org_cache.set_transaction_sample_rates(ORG_ID, {PROJECT_ID: ([], 0.5)})

        assert get_transaction_sample_rates(ORG_ID, PROJECT_ID, default_rate=1.0) == ({}, 0.5)
        assert emitted_sources == [("transaction_sample_rates", "per_org")]


@pytest.mark.django_db
class TestGetRecalibrationFactor:
    @override_options(SERVING_ON)
    def test_serves_the_per_org_factor_inside_the_serving_rollout(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        legacy_recalibration_cache.set_guarded_adjusted_factor(ORG_ID, 2.0)
        switch_org_to_per_org()
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_recalibration_factor(ORG_ID) == 3.0
        assert emitted_sources == [("recalibration_factor", "per_org")]

    @override_options(SERVING_OFF)
    def test_serves_the_legacy_factor_outside_the_serving_rollout(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        legacy_recalibration_cache.set_guarded_adjusted_factor(ORG_ID, 2.0)
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_recalibration_factor(ORG_ID) == 2.0
        assert emitted_sources == [("recalibration_factor", "legacy")]

    @override_options(SERVING_BY_ORG_ID)
    def test_a_listed_org_serves_the_per_org_factor_at_a_rate_of_zero(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        legacy_recalibration_cache.set_guarded_adjusted_factor(ORG_ID, 2.0)
        switch_org_to_per_org()
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_recalibration_factor(ORG_ID) == 3.0
        assert emitted_sources == [("recalibration_factor", "per_org")]

    @override_options(SERVING_BY_ORG_ID)
    def test_an_unlisted_org_serves_the_legacy_factor(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        other_org_id = ORG_ID + 1
        legacy_recalibration_cache.set_guarded_adjusted_factor(other_org_id, 2.0)

        assert get_recalibration_factor(other_org_id) == 2.0
        assert emitted_sources == [("recalibration_factor", "legacy")]

    @override_options(SERVING_ON)
    def test_a_missing_factor_on_both_sides_is_the_identity_factor(
        self, emitted_sources: list[tuple[str, str]]
    ) -> None:
        switch_org_to_per_org()

        assert get_recalibration_factor(ORG_ID) == 1.0
        assert emitted_sources == [("recalibration_factor", "per_org")]


@pytest.mark.django_db
class TestRecalibrationFactorCarryOver:
    """The pipeline that takes over serving continues from the factor it was handed.

    Both caches expire after the same short TTL, and each pipeline stops writing as soon as
    the other one serves. So a factor is only ever in both caches right after a switch.
    """

    @override_options(SERVING_ON)
    def test_the_per_org_pipeline_carries_the_legacy_factor_over(self) -> None:
        legacy_recalibration_cache.set_guarded_adjusted_factor(ORG_ID, 2.0)
        switch_org_to_per_org()

        assert get_recalibration_factor(ORG_ID) == 2.0
        assert get_previous_recalibration_factor(ORG_ID) == 2.0

    @override_options(SERVING_OFF)
    def test_the_legacy_pipeline_carries_the_per_org_factor_over(self) -> None:
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_recalibration_factor(ORG_ID) == 3.0
        assert get_previous_recalibration_factor(ORG_ID) == 3.0

    @override_options(SERVING_ON)
    def test_the_per_org_factor_wins_once_it_is_written(self) -> None:
        legacy_recalibration_cache.set_guarded_adjusted_factor(ORG_ID, 2.0)
        switch_org_to_per_org()
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_previous_recalibration_factor(ORG_ID) == 3.0

    @override_options(SERVING_OFF)
    def test_the_legacy_factor_wins_once_it_is_written(self) -> None:
        legacy_recalibration_cache.set_guarded_adjusted_factor(ORG_ID, 2.0)
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_previous_recalibration_factor(ORG_ID) == 2.0

    @override_options(SERVING_ON)
    def test_an_org_without_per_org_project_rates_reads_the_legacy_factor(self) -> None:
        legacy_recalibration_cache.set_guarded_adjusted_factor(ORG_ID, 2.0)
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_previous_recalibration_factor(ORG_ID) == 2.0

    @override_options({**SERVING_ON, "dynamic-sampling.per_org.killswitch": True})
    def test_the_killswitch_carries_the_per_org_factor_over(self) -> None:
        switch_org_to_per_org()
        per_org_cache.set_adjusted_factor(ORG_ID, 3.0)

        assert get_recalibration_factor(ORG_ID) == 3.0


@pytest.mark.django_db
class TestIsRecalibrationFactorServedPerOrg:
    """The legacy recalibration task reads this to decide whether to write its factor."""

    @override_options(SERVING_ON)
    def test_true_inside_the_serving_rollout(self) -> None:
        switch_org_to_per_org()

        assert is_recalibration_factor_served_per_org(ORG_ID) is True

    @override_options(SERVING_OFF)
    def test_false_outside_the_serving_rollout(self) -> None:
        switch_org_to_per_org()

        assert is_recalibration_factor_served_per_org(ORG_ID) is False

    @override_options(SERVING_ON)
    def test_false_while_the_per_org_project_rates_are_cold(self) -> None:
        assert is_recalibration_factor_served_per_org(ORG_ID) is False

    @override_options({**SERVING_ON, "dynamic-sampling.per_org.killswitch": True})
    def test_false_under_the_killswitch(self) -> None:
        switch_org_to_per_org()

        assert is_recalibration_factor_served_per_org(ORG_ID) is False

    @override_options(SERVING_BY_ORG_ID)
    def test_true_for_a_listed_org_at_a_rate_of_zero(self) -> None:
        switch_org_to_per_org()

        assert is_recalibration_factor_served_per_org(ORG_ID) is True

    @override_options(SERVING_BY_ORG_ID)
    def test_false_for_an_unlisted_org(self) -> None:
        switch_org_to_per_org()

        assert is_recalibration_factor_served_per_org(ORG_ID + 1) is False
