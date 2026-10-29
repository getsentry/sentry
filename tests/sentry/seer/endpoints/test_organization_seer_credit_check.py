from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.seer.credits import SeerOperation, estimate_credits
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class OrganizationSeerCreditCheckTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-credit-check"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @with_feature("organizations:seer-credit-checks")
    @patch("sentry.quotas.backend.has_seer_credits", return_value=True)
    def test_get_returns_has_enough_credits_when_billing_has_credits(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        response = self.get_success_response(self.organization.slug, operation="autofix_root_cause")

        assert response.data == {"hasEnoughCredits": True}
        mock_has_seer_credits.assert_called_once_with(
            org_id=self.organization.id,
            feature_id="autofix",
            predicted_credit_usage=estimate_credits(SeerOperation.AUTOFIX_ROOT_CAUSE),
        )

    @with_feature("organizations:seer-credit-checks")
    @patch("sentry.quotas.backend.has_seer_credits", return_value=False)
    def test_get_returns_not_enough_credits_when_billing_has_no_credits(
        self, mock_has_seer_credits: MagicMock
    ) -> None:
        response = self.get_success_response(self.organization.slug, operation="agent_chat_message")

        assert response.data == {"hasEnoughCredits": False}
        assert mock_has_seer_credits.call_args.kwargs["feature_id"] == "explorer"

    def test_get_returns_has_enough_credits_when_credit_checks_disabled(self) -> None:
        response = self.get_success_response(self.organization.slug, operation="autofix_solution")

        assert response.data == {"hasEnoughCredits": True}

    def test_get_returns_400_when_operation_missing(self) -> None:
        self.get_error_response(self.organization.slug, status_code=400)

    def test_get_returns_400_when_operation_invalid(self) -> None:
        self.get_error_response(self.organization.slug, operation="nightshift", status_code=400)
