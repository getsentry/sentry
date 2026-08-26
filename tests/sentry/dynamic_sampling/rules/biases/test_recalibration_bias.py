from __future__ import annotations

from sentry.dynamic_sampling.per_org import cache as per_org_recalibration_cache
from sentry.dynamic_sampling.rules.biases.recalibration_bias import RecalibrationBias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, RuleType, get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers import recalibrate_orgs as legacy_recalibration_cache
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


def _factor_rule(factor: float) -> dict:
    return {
        "samplingValue": {"type": "factor", "value": factor},
        "type": "trace",
        "condition": {"op": "and", "inner": []},
        "id": RESERVED_IDS[RuleType.RECALIBRATION_RULE],
    }


class RecalibrationBiasTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        redis = get_redis_client_for_ds()
        self.legacy_key = legacy_recalibration_cache.generate_recalibrate_orgs_cache_key(
            self.organization.id
        )
        self.per_org_key = per_org_recalibration_cache.generate_recalibrate_orgs_cache_key(
            self.organization.id
        )
        self.addCleanup(redis.delete, self.legacy_key, self.per_org_key)
        redis.set(self.legacy_key, 2.0)
        redis.set(self.per_org_key, 0.5)

    def test_serves_the_legacy_factor_by_default(self) -> None:
        rules = RecalibrationBias().generate_rules(self.project, base_sample_rate=1.0)

        assert rules == [_factor_rule(2.0)]

    @override_options({"dynamic-sampling.per_org.recalibration-serving-rollout-rate": 1.0})
    def test_serves_the_per_org_factor_once_switched_over(self) -> None:
        rules = RecalibrationBias().generate_rules(self.project, base_sample_rate=1.0)

        assert rules == [_factor_rule(0.5)]

    @override_options({"dynamic-sampling.per_org.recalibration-serving-rollout-rate": 1.0})
    def test_serves_no_rule_when_the_per_org_factor_is_the_identity(self) -> None:
        get_redis_client_for_ds().delete(self.per_org_key)

        rules = RecalibrationBias().generate_rules(self.project, base_sample_rate=1.0)

        # A missing per-org factor is the identity, and the legacy factor is not a
        # fallback for a switched-over org.
        assert rules == []
