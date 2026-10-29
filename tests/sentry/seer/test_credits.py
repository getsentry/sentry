from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.seer.credits import SeerOperation, can_run_seer_operation, estimate_credits
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class SeerCreditsTest(TestCase):
    def test_estimate_credits_returns_estimate_for_every_operation(self) -> None:
        for operation in SeerOperation:
            assert estimate_credits(operation) > 0

    @patch("sentry.quotas.backend.has_seer_credits", return_value=False)
    def test_can_run_seer_operation_skips_billing_when_credit_checks_disabled(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        assert can_run_seer_operation(self.organization, SeerOperation.AUTOFIX_ROOT_CAUSE)
        mock_has_seer_credits.assert_not_called()

    @with_feature("organizations:seer-credit-checks")
    @patch("sentry.quotas.backend.has_seer_credits", return_value=False)
    def test_can_run_seer_operation_returns_false_when_billing_has_no_credits(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        assert not can_run_seer_operation(self.organization, SeerOperation.AUTOFIX_ROOT_CAUSE)
        mock_has_seer_credits.assert_called_once_with(
            org_id=self.organization.id,
            feature_id="autofix",
            predicted_credit_usage=estimate_credits(SeerOperation.AUTOFIX_ROOT_CAUSE),
        )

    @with_feature("organizations:seer-credit-checks")
    @patch("sentry.quotas.backend.has_seer_credits", return_value=True)
    def test_can_run_seer_operation_returns_true_when_billing_has_credits(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        assert can_run_seer_operation(self.organization, SeerOperation.AGENT_CHAT_MESSAGE)
