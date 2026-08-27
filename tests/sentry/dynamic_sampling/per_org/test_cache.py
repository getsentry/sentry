from __future__ import annotations

from unittest.mock import DEFAULT, MagicMock, patch

import orjson

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.cache import (
    generate_project_sample_rates_cache_key,
    generate_transaction_sample_rates_cache_key,
    get_cached_rebalanced_project_sample_rates,
    get_cached_rebalanced_transaction_sample_rates,
    get_cached_recalibration_factor,
    get_project_sample_rate,
    get_transaction_sample_rates,
    set_project_sample_rates,
    set_transaction_sample_rates,
    write_caches,
)
from sentry.dynamic_sampling.per_org.results import DynamicSamplingResults
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.constants import MAX_REBALANCE_FACTOR, MIN_REBALANCE_FACTOR
from sentry.dynamic_sampling.tasks.helpers import (
    recalibrate_orgs as legacy_recalibration_cache,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    generate_boost_low_volume_transactions_cache_key,
)
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
    def test_per_org_cache_does_not_cross_pollinate_with_legacy_cache(self) -> None:
        org = self.create_organization()
        redis = get_redis_client_for_ds()
        legacy_key = legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        per_org_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.addCleanup(redis.delete, legacy_key, per_org_key)
        redis.delete(legacy_key, per_org_key)

        assert legacy_key != per_org_key

        redis.set(legacy_key, 2.5)
        assert legacy_recalibration_cache.get_adjusted_factor(org.id, source="task") == 2.5
        assert per_org_recalibration_cache.get_adjusted_factor(org.id, source="task") == 1.0

        redis.delete(legacy_key)
        redis.set(per_org_key, 3.5)
        assert per_org_recalibration_cache.get_adjusted_factor(org.id, source="task") == 3.5
        assert legacy_recalibration_cache.get_adjusted_factor(org.id, source="task") == 1.0

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


class InvalidateProjectConfigsTest(TestCase):
    """A pass that changed an organization's rates republishes its rules."""

    SERVING_ON = {"dynamic-sampling.per_org.serving-rollout-rate": 1.0}
    SERVING_OFF = {"dynamic-sampling.per_org.serving-rollout-rate": 0.0}

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

    def test_a_served_org_is_invalidated_once_for_all_of_its_projects(self) -> None:
        with override_options(self.SERVING_ON):
            invalidate = self._write(self._rebalanced(0.25))

        invalidate.assert_called_once_with(
            organization_id=self.organization.id, trigger="dynamic_sampling_per_org"
        )

    def test_an_org_served_from_the_legacy_caches_is_left_alone(self) -> None:
        with override_options(self.SERVING_OFF):
            invalidate = self._write(self._rebalanced(0.25))

        invalidate.assert_not_called()

    def test_a_listed_org_is_invalidated_at_a_serving_rate_of_zero(self) -> None:
        with override_options(
            {
                "dynamic-sampling.per_org.serving-rollout-rate": 0.0,
                "dynamic-sampling.per_org.serving-org-ids": [self.organization.id],
            }
        ):
            invalidate = self._write(self._rebalanced(0.25))

        invalidate.assert_called_once()

    def test_a_pass_that_changed_no_rate_does_not_republish(self) -> None:
        with override_options(self.SERVING_ON):
            self._write(self._rebalanced(0.25))
            invalidate = self._write(self._rebalanced(0.25))

        invalidate.assert_not_called()

    def test_a_pass_that_wrote_nothing_does_not_republish(self) -> None:
        with override_options(self.SERVING_ON):
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

    def test_a_pass_without_a_factor_leaves_the_stored_one_alone(self) -> None:
        mocks = self._write(DynamicSamplingResults())

        mocks[SET_FACTOR].assert_not_called()
        mocks[DELETE_FACTOR].assert_not_called()

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

    def test_project_sample_rates_do_not_share_keys_with_the_legacy_cache(self) -> None:
        legacy_key = generate_boost_low_volume_projects_cache_key(self.organization.id)
        self.addCleanup(self.redis.delete, legacy_key)
        self.redis.hset(legacy_key, str(self.project.id), "0.2")

        assert legacy_key != generate_project_sample_rates_cache_key(self.organization.id)
        assert get_project_sample_rate(self.organization.id, self.project.id) is None

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


class LegacyCacheReadersTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    def test_get_cached_recalibration_factor_reads_the_legacy_cache(self) -> None:
        org = self.create_organization()
        cache_key = legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)
        self.redis.set(cache_key, 2.5)

        assert get_cached_recalibration_factor(org.id) == 2.5

    def test_get_cached_recalibration_factor_reports_a_cache_miss_as_the_identity(self) -> None:
        org = self.create_organization()
        cache_key = legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(org.id)
        self.addCleanup(self.redis.delete, cache_key)

        # Writing the identity factor deletes the key, so a miss is how 1.0 is stored.
        legacy_recalibration_cache.set_guarded_adjusted_factor(org.id, 1.0)
        assert self.redis.get(cache_key) is None
        assert get_cached_recalibration_factor(org.id) == 1.0

    def test_get_cached_rebalanced_project_sample_rates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        cache_key = generate_boost_low_volume_projects_cache_key(org.id)
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)
        self.redis.hset(cache_key, str(project.id), "0.25")

        assert get_cached_rebalanced_project_sample_rates(org.id) == {project.id: 0.25}

    def test_get_cached_rebalanced_transaction_sample_rates(self) -> None:
        org = self.create_organization()
        project_hit = self.create_project(organization=org)
        project_miss = self.create_project(organization=org)
        cache_key = generate_boost_low_volume_transactions_cache_key(
            org_id=org.id, proj_id=project_hit.id
        )
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)
        self.redis.set(cache_key, orjson.dumps([{"checkout": 0.3}, 0.5]).decode())

        result = get_cached_rebalanced_transaction_sample_rates(
            org.id, [project_hit.id, project_miss.id]
        )

        assert result == {
            project_hit.id: ({"checkout": 0.3}, 0.5),
            project_miss.id: None,
        }
