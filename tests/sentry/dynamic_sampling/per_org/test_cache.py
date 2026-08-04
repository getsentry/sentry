from __future__ import annotations

from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers import (
    recalibrate_orgs as legacy_recalibration_cache,
)
from sentry.testutils.cases import TestCase


class PerOrgRecalibrationCacheTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()
        self.org = self.create_organization()
        self.cache_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(
            self.org.id
        )
        self.legacy_cache_key = legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(
            self.org.id
        )
        self.redis.delete(self.cache_key, self.legacy_cache_key)
        self.addCleanup(self.redis.delete, self.cache_key, self.legacy_cache_key)

    def test_does_not_cross_pollinate_with_the_legacy_cache(self) -> None:
        assert self.cache_key != self.legacy_cache_key

        self.redis.set(self.legacy_cache_key, 2.5)
        assert legacy_recalibration_cache.get_adjusted_factor(self.org.id) == 2.5
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0

        self.redis.delete(self.legacy_cache_key)
        self.redis.set(self.cache_key, 3.5)
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 3.5
        assert legacy_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0

    def test_sets_and_deletes_the_adjusted_factor(self) -> None:
        per_org_recalibration_cache.set_guarded_adjusted_factor(self.org.id, 2.5)
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 2.5

        # A factor of 1.0 means "no adjustment", so it clears the key instead of storing it.
        per_org_recalibration_cache.set_guarded_adjusted_factor(self.org.id, 1.0)
        assert self.redis.get(self.cache_key) is None
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0

    def test_missing_factor_defaults_to_no_adjustment(self) -> None:
        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0

    def test_delete_is_idempotent(self) -> None:
        per_org_recalibration_cache.delete_adjusted_factor(self.org.id)
        per_org_recalibration_cache.delete_adjusted_factor(self.org.id)

        assert per_org_recalibration_cache.get_adjusted_factor(self.org.id) == 1.0
