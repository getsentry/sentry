from __future__ import annotations

from unittest.mock import DEFAULT, MagicMock

from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.per_org.cache import write_caches
from sentry.dynamic_sampling.per_org.results import DynamicSamplingResults, RecalibrationOutcome
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers import (
    recalibrate_orgs as legacy_recalibration_cache,
)
from sentry.testutils.cases import TestCase
from tests.sentry.dynamic_sampling.per_org.test_helpers import (
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

        per_org_recalibration_cache.set_guarded_adjusted_factor(org.id, 2.5)
        assert per_org_recalibration_cache.get_adjusted_factor(org.id, source="task") == 2.5

        per_org_recalibration_cache.set_guarded_adjusted_factor(org.id, 1.0)
        assert per_org_recalibration_cache.get_adjusted_factor(org.id, source="task") == 1.0


class WriteCachesTest(TestCase):
    def _write(self, results: DynamicSamplingResults) -> dict[str, MagicMock]:
        config = mock_configuration(self.organization, results=results)
        with patch_configuration({SET_FACTOR: DEFAULT, DELETE_FACTOR: DEFAULT}) as mocks:
            write_caches(config)
        return mocks

    def test_an_applied_factor_is_stored(self) -> None:
        mocks = self._write(
            DynamicSamplingResults(
                recalibration_factor=1.5,
                recalibration_outcome=RecalibrationOutcome.APPLIED,
            )
        )

        mocks[SET_FACTOR].assert_called_once_with(self.organization.id, 1.5)
        mocks[DELETE_FACTOR].assert_not_called()

    def test_a_factor_out_of_bounds_clears_the_stored_one(self) -> None:
        mocks = self._write(
            DynamicSamplingResults(recalibration_outcome=RecalibrationOutcome.OUT_OF_BOUNDS)
        )

        # A stale factor must not keep being applied once the new one is rejected.
        mocks[DELETE_FACTOR].assert_called_once_with(self.organization.id)
        mocks[SET_FACTOR].assert_not_called()

    def test_a_pass_without_enough_volume_leaves_the_stored_factor_alone(self) -> None:
        mocks = self._write(
            DynamicSamplingResults(recalibration_outcome=RecalibrationOutcome.NO_FACTOR)
        )

        mocks[SET_FACTOR].assert_not_called()
        mocks[DELETE_FACTOR].assert_not_called()

    def test_a_pass_that_never_recalibrated_writes_nothing(self) -> None:
        mocks = self._write(DynamicSamplingResults())

        mocks[SET_FACTOR].assert_not_called()
        mocks[DELETE_FACTOR].assert_not_called()
