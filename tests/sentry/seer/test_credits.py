from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsRequest,
    CheckSeerCreditsResponse,
)

from sentry.seer.credits import (
    SEER_OPERATION_ESTIMATES,
    SeerFeature,
    SeerOperation,
    can_run_seer_operation,
    get_denial_reason,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class SeerCreditsTest(TestCase):
    def test_every_operation_has_a_credit_estimate(self) -> None:
        for operation in SeerOperation:
            assert SEER_OPERATION_ESTIMATES[operation]() > 0

    @with_feature("organizations:token-billed-seer-enabled")
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=False),
    )
    def test_can_run_seer_operation_skips_billing_when_credit_checks_disabled(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert can_run_seer_operation(
            self.organization, SeerFeature.AUTOFIX_WEB, SeerOperation.AUTOFIX_ROOT_CAUSE
        )
        mock_check_seer_credits.assert_not_called()

    @with_feature("organizations:seer-credit-checks")
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=False),
    )
    def test_can_run_seer_operation_skips_billing_when_not_token_billed(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert can_run_seer_operation(
            self.organization, SeerFeature.AUTOFIX_WEB, SeerOperation.AUTOFIX_ROOT_CAUSE
        )
        mock_check_seer_credits.assert_not_called()

    @with_feature(["organizations:seer-credit-checks", "organizations:token-billed-seer-enabled"])
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=False),
    )
    def test_can_run_seer_operation_returns_false_when_billing_has_no_credits(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert not can_run_seer_operation(
            self.organization, SeerFeature.AUTOFIX_WEB, SeerOperation.AUTOFIX_ROOT_CAUSE
        )
        mock_check_seer_credits.assert_called_once_with(
            CheckSeerCreditsRequest(
                organization_id=self.organization.id,
                feature_id="autofix_web",
                predicted_credit_usage=SEER_OPERATION_ESTIMATES[SeerOperation.AUTOFIX_ROOT_CAUSE](),
                take_lease=False,
            )
        )

    @with_feature(["organizations:seer-credit-checks", "organizations:token-billed-seer-enabled"])
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=True),
    )
    def test_can_run_seer_operation_returns_true_when_billing_has_credits(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert can_run_seer_operation(
            self.organization, SeerFeature.SEER_AGENT, SeerOperation.AGENT_CHAT_MESSAGE
        )


@pytest.mark.parametrize(
    ("denial_reason", "expected"),
    [
        (CheckSeerCreditsResponse.DENIAL_REASON_NOT_ENOUGH_CREDITS, "not_enough_credits"),
        (CheckSeerCreditsResponse.DENIAL_REASON_DAILY_CAP_EXCEEDED, "daily_cap_exceeded"),
        (CheckSeerCreditsResponse.DENIAL_REASON_UNSPECIFIED, None),
        (99, None),
    ],
)
def test_get_denial_reason(denial_reason: int, expected: str | None) -> None:
    response = CheckSeerCreditsResponse(has_enough_credits=False)
    response.denial_reason = denial_reason  # type: ignore[assignment]
    assert get_denial_reason(response) == expected
