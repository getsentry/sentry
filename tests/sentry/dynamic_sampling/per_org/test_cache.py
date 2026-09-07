from __future__ import annotations

from datetime import timedelta
from unittest.mock import DEFAULT, MagicMock, patch

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.cache import (
    MAX_REBALANCE_FACTOR,
    MIN_REBALANCE_FACTOR,
    MIN_RECALIBRATION_FACTOR_AGE,
    adjusted_factor_ttl_ms,
    bounded_rebalance_factor,
    generate_organization_sample_rate_cache_key,
    generate_project_sample_rates_cache_key,
    generate_transaction_sample_rates_cache_key,
    get_organization_sample_rate,
    get_project_sample_rate,
    get_transaction_sample_rates,
    set_organization_sample_rate,
    set_project_sample_rates,
    set_transaction_sample_rates,
    write_caches,
)
from sentry.dynamic_sampling.per_org.results import DynamicSamplingResults
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from tests.sentry.dynamic_sampling.per_org.test_helpers import (
    CACHE,
    DELETE_FACTOR,
    SET_FACTOR,
    mock_configuration,
    patch_configuration,
)


class PerOrgRecalibrationCacheTest(TestCase):
    def test_per_org_cache_sets_and_deletes_adjusted_factor(self) -> None:
        org = self.create_organization()
        redis = get_redis_client_for_ds()
        cache_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.addCleanup(redis.delete, cache_key)
        redis.delete(cache_key)

        per_org_recalibration_cache.set_adjusted_factor(org.id, 2.5)
        assert per_org_recalibration_cache.get_adjusted_factor(org.id, source="task") == 2.5

        per_org_recalibration_cache.set_adjusted_factor(org.id, 1.0)
        assert per_org_recalibration_cache.get_adjusted_factor(org.id, source="task") == 1.0

    @override_options({"dynamic-sampling.recalibration.factor-ttl-minutes": 25})
    def test_set_adjusted_factor_uses_the_ttl_option(self) -> None:
        org = self.create_organization()
        redis = get_redis_client_for_ds()
        cache_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.addCleanup(redis.delete, cache_key)

        per_org_recalibration_cache.set_adjusted_factor(org.id, 2.0)

        assert 24 * 60 * 1000 < redis.pttl(cache_key) <= 25 * 60 * 1000


class BoundedRebalanceFactorTest(TestCase):
    def test_an_out_of_bounds_factor_is_discarded_by_default(self) -> None:
        assert bounded_rebalance_factor(1.5) == 1.5
        assert bounded_rebalance_factor(MIN_REBALANCE_FACTOR) == MIN_REBALANCE_FACTOR
        assert bounded_rebalance_factor(MAX_REBALANCE_FACTOR) == MAX_REBALANCE_FACTOR
        assert bounded_rebalance_factor(MIN_REBALANCE_FACTOR / 2) is None
        assert bounded_rebalance_factor(MAX_REBALANCE_FACTOR * 2) is None

    @override_options({"dynamic-sampling.recalibration.clamp-factor": True})
    def test_an_out_of_bounds_factor_is_clamped_when_the_option_is_on(self) -> None:
        assert bounded_rebalance_factor(1.5) == 1.5
        assert bounded_rebalance_factor(MIN_REBALANCE_FACTOR / 2) == MIN_REBALANCE_FACTOR
        assert bounded_rebalance_factor(MAX_REBALANCE_FACTOR * 2) == MAX_REBALANCE_FACTOR


class InvalidateProjectConfigsTest(TestCase):
    """A pass that changed an organization's rates republishes its rules."""

    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(organization=self.organization)
        self.addCleanup(
            get_redis_client_for_ds().delete,
            generate_project_sample_rates_cache_key(self.organization.id),
        )

    def _write(self, results: DynamicSamplingResults) -> MagicMock:
        config = mock_configuration(self.organization, results=results)
        with patch(f"{CACHE}.schedule_invalidate_project_config") as invalidate:
            write_caches(config)
        return invalidate

    def _rebalanced(self, sample_rate: float) -> DynamicSamplingResults:
        return DynamicSamplingResults(
            rebalanced_projects=[
                RebalancedItem(id=self.project.id, count=10, new_sample_rate=sample_rate)
            ]
        )

    def test_a_changed_rate_republishes_once_for_all_projects(self) -> None:
        invalidate = self._write(self._rebalanced(0.25))

        invalidate.assert_called_once_with(
            organization_id=self.organization.id, trigger="dynamic_sampling_per_org"
        )

    def test_a_pass_that_changed_no_rate_does_not_republish(self) -> None:
        self._write(self._rebalanced(0.25))
        invalidate = self._write(self._rebalanced(0.25))

        invalidate.assert_not_called()

    def test_a_moved_recalibration_factor_is_republished(self) -> None:
        with patch_configuration({SET_FACTOR: DEFAULT, DELETE_FACTOR: DEFAULT}):
            invalidate = self._write(DynamicSamplingResults(recalibration_factor=1.5))

        invalidate.assert_called_once()

    def test_a_cleared_recalibration_factor_is_republished(self) -> None:
        with patch_configuration({SET_FACTOR: DEFAULT, DELETE_FACTOR: DEFAULT}):
            invalidate = self._write(
                DynamicSamplingResults(recalibration_factor=MAX_REBALANCE_FACTOR * 2)
            )

        invalidate.assert_called_once()

    def test_a_pass_that_wrote_nothing_does_not_republish(self) -> None:
        invalidate = self._write(DynamicSamplingResults())

        invalidate.assert_not_called()


class WriteCachesTest(TestCase):
    def _write(self, results: DynamicSamplingResults) -> dict[str, MagicMock]:
        config = mock_configuration(self.organization, results=results)
        with patch_configuration({SET_FACTOR: DEFAULT, DELETE_FACTOR: DEFAULT}) as mocks:
            write_caches(config)
        return mocks

    def test_a_factor_within_the_rebalance_bounds_is_stored(self) -> None:
        mocks = self._write(DynamicSamplingResults(recalibration_factor=1.5))

        mocks[SET_FACTOR].assert_called_once_with(self.organization.id, 1.5)
        mocks[DELETE_FACTOR].assert_not_called()

    def test_a_factor_at_the_rebalance_bounds_is_stored(self) -> None:
        for factor in (MIN_REBALANCE_FACTOR, MAX_REBALANCE_FACTOR):
            mocks = self._write(DynamicSamplingResults(recalibration_factor=factor))

            mocks[SET_FACTOR].assert_called_once_with(self.organization.id, factor)
            mocks[DELETE_FACTOR].assert_not_called()

    def test_a_factor_out_of_bounds_clears_the_stored_one(self) -> None:
        for factor in (MIN_REBALANCE_FACTOR / 2, MAX_REBALANCE_FACTOR * 2):
            mocks = self._write(DynamicSamplingResults(recalibration_factor=factor))

            # A stale factor must not keep being applied once the new one is rejected.
            mocks[DELETE_FACTOR].assert_called_once_with(self.organization.id)
            mocks[SET_FACTOR].assert_not_called()

    def test_a_factor_out_of_bounds_is_clamped_when_the_clamp_option_is_on(self) -> None:
        with override_options({"dynamic-sampling.recalibration.clamp-factor": True}):
            for factor, bound in (
                (MIN_REBALANCE_FACTOR / 2, MIN_REBALANCE_FACTOR),
                (MAX_REBALANCE_FACTOR * 2, MAX_REBALANCE_FACTOR),
            ):
                mocks = self._write(DynamicSamplingResults(recalibration_factor=factor))

                mocks[SET_FACTOR].assert_called_once_with(self.organization.id, bound)
                mocks[DELETE_FACTOR].assert_not_called()

    def test_a_pass_without_a_factor_leaves_the_stored_one_alone(self) -> None:
        mocks = self._write(DynamicSamplingResults())

        mocks[SET_FACTOR].assert_not_called()
        mocks[DELETE_FACTOR].assert_not_called()

    def _store_factor_with_age(self, age: timedelta) -> None:
        redis = get_redis_client_for_ds()
        cache_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(
            self.organization.id
        )
        self.addCleanup(redis.delete, cache_key)
        redis.set(cache_key, 2.0)
        redis.pexpire(cache_key, adjusted_factor_ttl_ms() - int(age.total_seconds() * 1000))

    def test_a_factor_stored_within_the_cycle_is_left_alone(self) -> None:
        """A second pass in one cycle would compound the correction, so it does not write."""
        self._store_factor_with_age(MIN_RECALIBRATION_FACTOR_AGE - timedelta(minutes=1))

        for factor in (1.5, MAX_REBALANCE_FACTOR * 2):
            mocks = self._write(DynamicSamplingResults(recalibration_factor=factor))

            mocks[SET_FACTOR].assert_not_called()
            mocks[DELETE_FACTOR].assert_not_called()

    def test_a_factor_older_than_the_minimum_age_is_overwritten(self) -> None:
        self._store_factor_with_age(MIN_RECALIBRATION_FACTOR_AGE + timedelta(seconds=5))

        mocks = self._write(DynamicSamplingResults(recalibration_factor=1.5))

        mocks[SET_FACTOR].assert_called_once_with(self.organization.id, 1.5)

    def test_a_factor_without_an_expiry_is_overwritten(self) -> None:
        redis = get_redis_client_for_ds()
        cache_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(
            self.organization.id
        )
        self.addCleanup(redis.delete, cache_key)
        redis.set(cache_key, 2.0)

        mocks = self._write(DynamicSamplingResults(recalibration_factor=1.5))

        mocks[SET_FACTOR].assert_called_once_with(self.organization.id, 1.5)

    def test_the_balanced_sample_rates_are_stored(self) -> None:
        org_id = self.organization.id
        project_id = self.create_project(organization=self.organization).id
        self.addCleanup(
            get_redis_client_for_ds().delete,
            generate_project_sample_rates_cache_key(org_id),
            generate_transaction_sample_rates_cache_key(org_id, project_id),
        )

        self._write(
            DynamicSamplingResults(
                rebalanced_projects=[RebalancedItem(id=project_id, count=100, new_sample_rate=0.5)],
                rebalanced_transactions={
                    project_id: (
                        [RebalancedItem(id="checkout", count=10, new_sample_rate=0.3)],
                        0.4,
                    )
                },
            )
        )

        assert get_project_sample_rate(org_id, project_id) == 0.5
        assert get_transaction_sample_rates(org_id, project_id) == ({"checkout": 0.3}, 0.4)

    def test_a_pass_that_balanced_nothing_stores_no_sample_rates(self) -> None:
        org_id = self.organization.id
        project_id = self.create_project(organization=self.organization).id

        self._write(DynamicSamplingResults())

        assert get_project_sample_rate(org_id, project_id) is None
        assert get_transaction_sample_rates(org_id, project_id) is None


class PerOrgSampleRateCacheTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()
        self.project = self.create_project(organization=self.organization)
        self.addCleanup(
            self.redis.delete,
            generate_project_sample_rates_cache_key(self.organization.id),
            generate_transaction_sample_rates_cache_key(self.organization.id, self.project.id),
        )

    def test_project_sample_rates_round_trip(self) -> None:
        other = self.create_project(organization=self.organization)
        missing = self.create_project(organization=self.organization)
        set_project_sample_rates(
            self.organization.id,
            [
                RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.25),
                RebalancedItem(id=other.id, count=20, new_sample_rate=1.0),
            ],
        )

        assert get_project_sample_rate(self.organization.id, self.project.id) == 0.25
        assert get_project_sample_rate(self.organization.id, other.id) == 1.0
        assert get_project_sample_rate(self.organization.id, missing.id) is None

    def test_project_sample_rates_skip_a_rate_that_did_not_move(self) -> None:
        other = self.create_project(organization=self.organization)
        cache_key = generate_project_sample_rates_cache_key(self.organization.id)
        # Stored out of band so that a skipped write is visible: the value is equal to 0.25
        # within epsilon, so only a rewrite would replace it.
        self.redis.hset(cache_key, str(self.project.id), "0.2500000000001")

        set_project_sample_rates(
            self.organization.id,
            [
                RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.25),
                RebalancedItem(id=other.id, count=20, new_sample_rate=0.75),
            ],
        )

        assert self.redis.hget(cache_key, str(self.project.id)) == "0.2500000000001"
        assert self.redis.hget(cache_key, str(other.id)) == "0.75"

    def test_project_sample_rates_renew_the_expiry_when_no_rate_moved(self) -> None:
        cache_key = generate_project_sample_rates_cache_key(self.organization.id)
        items = [RebalancedItem(id=self.project.id, count=10, new_sample_rate=0.25)]
        set_project_sample_rates(self.organization.id, items)
        self.redis.pexpire(cache_key, 1000)

        set_project_sample_rates(self.organization.id, items)

        assert self.redis.pttl(cache_key) > 1000

    def test_transaction_sample_rates_round_trip(self) -> None:
        missing = self.create_project(organization=self.organization)
        set_transaction_sample_rates(
            self.organization.id,
            {
                self.project.id: (
                    [RebalancedItem(id="/checkout", count=10, new_sample_rate=0.3)],
                    0.4,
                )
            },
        )

        assert get_transaction_sample_rates(self.organization.id, self.project.id) == (
            {"/checkout": 0.3},
            0.4,
        )
        assert get_transaction_sample_rates(self.organization.id, missing.id) is None

    def test_a_corrupt_entry_reads_as_a_miss(self) -> None:
        self.redis.set(
            generate_transaction_sample_rates_cache_key(self.organization.id, self.project.id),
            "not json",
        )

        with patch("sentry.dynamic_sampling.per_org.cache.sentry_sdk.capture_exception") as capture:
            assert get_transaction_sample_rates(self.organization.id, self.project.id) is None

        assert capture.call_count == 1


class OrganizationSampleRateCacheTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()
        self.addCleanup(
            self.redis.delete, generate_organization_sample_rate_cache_key(self.organization.id)
        )

    def test_round_trip(self) -> None:
        set_organization_sample_rate(self.organization.id, 0.25)

        assert get_organization_sample_rate(self.organization.id) == 0.25

    def test_a_missing_rate_reads_as_none(self) -> None:
        assert get_organization_sample_rate(self.organization.id) is None

    def test_a_pass_without_a_rate_leaves_the_stored_one_alone(self) -> None:
        set_organization_sample_rate(self.organization.id, 0.25)

        set_organization_sample_rate(self.organization.id, None)

        assert get_organization_sample_rate(self.organization.id) == 0.25

    def test_write_caches_stores_the_rate_the_pass_balanced_against(self) -> None:
        config = mock_configuration(self.organization, sample_rate=0.5)

        write_caches(config)

        assert get_organization_sample_rate(self.organization.id) == 0.5
