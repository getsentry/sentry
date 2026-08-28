from unittest.mock import MagicMock, patch

from sentry.dynamic_sampling import RESERVED_IDS, RuleType
from sentry.dynamic_sampling.rules.biases.recalibration_bias import RecalibrationBias
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

BIAS = "sentry.dynamic_sampling.rules.biases.recalibration_bias"


class RecalibrationBiasTest(TestCase):
    def _generate(self, factor: float) -> tuple[list, MagicMock]:
        with (
            patch(f"{BIAS}.get_recalibration_factor", return_value=factor),
            patch(f"{BIAS}.logger") as logger,
        ):
            rules = RecalibrationBias().generate_rules(self.project, base_sample_rate=1.0)
        return rules, logger

    def test_emits_a_factor_rule(self) -> None:
        rules, _ = self._generate(0.5)

        assert rules == [
            {
                "samplingValue": {"type": "factor", "value": 0.5},
                "type": "trace",
                "condition": {"op": "and", "inner": []},
                "id": RESERVED_IDS[RuleType.RECALIBRATION_RULE],
            }
        ]

    def test_the_identity_factor_emits_no_rule(self) -> None:
        rules, _ = self._generate(1.0)

        assert rules == []

    def test_a_listed_org_logs_the_factor(self) -> None:
        with override_options({"dynamic-sampling.per_org.serving-org-ids": [self.organization.id]}):
            _, logger = self._generate(0.5)

        logger.info.assert_called_once_with(
            "dynamic_sampling.recalibration_bias",
            extra={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "project_mode": False,
                "adjusted_factor": 0.5,
            },
        )

    def test_an_unlisted_org_does_not_log(self) -> None:
        with override_options({"dynamic-sampling.per_org.serving-org-ids": []}):
            _, logger = self._generate(0.5)

        logger.info.assert_not_called()
