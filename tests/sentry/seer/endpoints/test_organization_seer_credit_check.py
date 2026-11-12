from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsRequest,
    CheckSeerCreditsResponse,
)

from sentry.seer.credits import SEER_OPERATION_ESTIMATES, SeerOperation
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class OrganizationSeerCreditCheckTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-credit-check"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @with_feature(["organizations:seer-credit-checks", "organizations:token-billed-seer-enabled"])
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=True),
    )
    def test_get_returns_has_enough_credits_when_billing_has_credits(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        response = self.get_success_response(self.organization.slug, operation="autofix_root_cause")

        assert response.data == {"hasEnoughCredits": True, "denialReason": None}
        mock_check_seer_credits.assert_called_once_with(
            CheckSeerCreditsRequest(
                organization_id=self.organization.id,
                feature_id="autofix",
                predicted_credit_usage=SEER_OPERATION_ESTIMATES[SeerOperation.AUTOFIX_ROOT_CAUSE](),
                take_lease=False,
            )
        )

    @with_feature(["organizations:seer-credit-checks", "organizations:token-billed-seer-enabled"])
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=False),
    )
    def test_get_returns_not_enough_credits_when_billing_has_no_credits(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        response = self.get_success_response(self.organization.slug, operation="agent_chat_message")

        assert response.data == {"hasEnoughCredits": False, "denialReason": None}
        assert mock_check_seer_credits.call_args.args[0].feature_id == "explorer"

    @with_feature(["organizations:seer-credit-checks", "organizations:token-billed-seer-enabled"])
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(
            has_enough_credits=False,
            denial_reason=CheckSeerCreditsResponse.DENIAL_REASON_NOT_ENOUGH_CREDITS,
        ),
    )
    def test_get_returns_not_enough_credits_denial_reason(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        response = self.get_success_response(self.organization.slug, operation="agent_chat_message")

        assert response.data == {"hasEnoughCredits": False, "denialReason": "not_enough_credits"}

    @with_feature(["organizations:seer-credit-checks", "organizations:token-billed-seer-enabled"])
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(
            has_enough_credits=False,
            denial_reason=CheckSeerCreditsResponse.DENIAL_REASON_DAILY_CAP_EXCEEDED,
        ),
    )
    def test_get_returns_daily_cap_exceeded_denial_reason(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        response = self.get_success_response(self.organization.slug, operation="agent_chat_message")

        assert response.data == {"hasEnoughCredits": False, "denialReason": "daily_cap_exceeded"}

    def test_get_returns_has_enough_credits_when_credit_checks_disabled(self) -> None:
        response = self.get_success_response(self.organization.slug, operation="autofix_solution")

        assert response.data == {"hasEnoughCredits": True, "denialReason": None}

    @with_feature("organizations:seer-credit-checks")
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=False),
    )
    def test_get_returns_has_enough_credits_when_not_token_billed(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        response = self.get_success_response(self.organization.slug, operation="autofix_solution")

        assert response.data == {"hasEnoughCredits": True, "denialReason": None}
        mock_check_seer_credits.assert_not_called()

    def test_get_returns_400_when_operation_missing(self) -> None:
        self.get_error_response(self.organization.slug, status_code=400)

    def test_get_returns_400_when_operation_invalid(self) -> None:
        self.get_error_response(self.organization.slug, operation="nightshift", status_code=400)
