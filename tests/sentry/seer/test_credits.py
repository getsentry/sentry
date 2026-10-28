from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.seer.credits import SeerOperation, estimate_credits, has_seer_credits
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class SeerCreditsTest(TestCase):
    def test_estimate_credits_returns_estimate_for_every_operation(self) -> None:
        for operation in SeerOperation:
            assert estimate_credits(self.organization, operation) > 0

    @with_feature("organizations:seer-credit-checks")
    @patch("sentry.quotas.backend.has_seer_credits", return_value=False)
    def test_has_seer_credits_skips_billing_when_not_token_billed(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        assert has_seer_credits(self.organization, SeerOperation.AUTOFIX_ROOT_CAUSE)
        mock_has_seer_credits.assert_not_called()

    @with_feature("organizations:token-billed-seer-enabled")
    @patch("sentry.quotas.backend.has_seer_credits", return_value=False)
    def test_has_seer_credits_skips_billing_when_credit_checks_disabled(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        assert has_seer_credits(self.organization, SeerOperation.AUTOFIX_ROOT_CAUSE)
        mock_has_seer_credits.assert_not_called()

    @with_feature(
        {"organizations:seer-credit-checks": True, "organizations:token-billed-seer-enabled": True}
    )
    @patch("sentry.quotas.backend.has_seer_credits", return_value=False)
    def test_has_seer_credits_returns_false_when_billing_has_no_credits(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        assert not has_seer_credits(self.organization, SeerOperation.AUTOFIX_ROOT_CAUSE)
        mock_has_seer_credits.assert_called_once_with(
            org_id=self.organization.id,
            feature_id="autofix",
            predicted_credit_usage=estimate_credits(
                self.organization, SeerOperation.AUTOFIX_ROOT_CAUSE
            ),
        )

    @with_feature(
        {"organizations:seer-credit-checks": True, "organizations:token-billed-seer-enabled": True}
    )
    @patch("sentry.quotas.backend.has_seer_credits", return_value=True)
    def test_has_seer_credits_returns_true_when_billing_has_credits(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        assert has_seer_credits(self.organization, SeerOperation.AGENT_CHAT_MESSAGE)
