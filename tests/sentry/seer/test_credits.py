from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sentry_protos.billing.v1.common.v1.seer_billing_feature_pb2 import (
    SEER_BILLING_FEATURE_AUTOFIX_WEB,
    SEER_BILLING_FEATURE_SEER_AGENT,
)
from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsRequest,
    CheckSeerCreditsResponse,
)

from sentry.seer.credits import (
    SEER_OPERATION_ESTIMATES,
    SeerOperation,
    check_seer_operation,
    get_current_denial_reason,
    get_denial_reason,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class SeerCreditsTest(TestCase):
    def test_every_operation_has_a_credit_estimate(self) -> None:
        for operation in SeerOperation:
            assert SEER_OPERATION_ESTIMATES[operation]() > 0

    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=False),
    )
    def test_check_seer_operation_skips_billing_when_not_token_billed(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert check_seer_operation(
            self.organization, SEER_BILLING_FEATURE_AUTOFIX_WEB, SeerOperation.AUTOFIX_ROOT_CAUSE
        ).has_enough_credits
        mock_check_seer_credits.assert_not_called()

    @with_feature("organizations:token-billed-seer-enabled")
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=False),
    )
    def test_check_seer_operation_is_refused_when_billing_has_no_credits(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert not check_seer_operation(
            self.organization, SEER_BILLING_FEATURE_AUTOFIX_WEB, SeerOperation.AUTOFIX_ROOT_CAUSE
        ).has_enough_credits
        mock_check_seer_credits.assert_called_once_with(
            CheckSeerCreditsRequest(
                organization_id=self.organization.id,
                feature_id="autofix_web",
                predicted_credit_usage=SEER_OPERATION_ESTIMATES[SeerOperation.AUTOFIX_ROOT_CAUSE](),
                take_lease=False,
            )
        )

    @with_feature("organizations:token-billed-seer-enabled")
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(has_enough_credits=True),
    )
    def test_check_seer_operation_passes_when_billing_has_credits(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert check_seer_operation(
            self.organization, SEER_BILLING_FEATURE_SEER_AGENT, SeerOperation.AGENT_CHAT_MESSAGE
        ).has_enough_credits

    @with_feature("organizations:token-billed-seer-enabled")
    @patch(
        "sentry.seer_credit.backend.check_seer_credits",
        return_value=CheckSeerCreditsResponse(
            has_enough_credits=False,
            denial_reason=CheckSeerCreditsResponse.DENIAL_REASON_DAILY_CAP_EXCEEDED,
        ),
    )
    def test_get_current_denial_reason(self, _mock_check_seer_credits: MagicMock) -> None:
        assert (
            get_current_denial_reason(
                self.organization, SEER_BILLING_FEATURE_SEER_AGENT, SeerOperation.AGENT_CHAT_MESSAGE
            )
            == "daily_cap_exceeded"
        )

    @with_feature("organizations:token-billed-seer-enabled")
    @patch("sentry.seer_credit.backend.check_seer_credits", side_effect=RuntimeError("down"))
    def test_get_current_denial_reason_is_none_when_the_check_fails(
        self, _mock_check_seer_credits: MagicMock
    ) -> None:
        assert (
            get_current_denial_reason(
                self.organization, SEER_BILLING_FEATURE_SEER_AGENT, SeerOperation.AGENT_CHAT_MESSAGE
            )
            is None
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
