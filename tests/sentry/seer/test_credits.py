from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_has_seer_credits_pb2 import (
    HasSeerCreditsRequest,
    HasSeerCreditsResponse,
)

from sentry.seer.credits import SEER_OPERATIONS, SeerOperation, can_run_seer_operation
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class SeerCreditsTest(TestCase):
    def test_every_operation_has_a_credit_estimate(self) -> None:
        for operation in SeerOperation:
            assert SEER_OPERATIONS[operation].estimate() > 0

    @patch(
        "sentry.quotas.backend.check_seer_credits",
        return_value=HasSeerCreditsResponse(has_enough_credits=False),
    )
    def test_can_run_seer_operation_skips_billing_when_credit_checks_disabled(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert can_run_seer_operation(self.organization, SeerOperation.AUTOFIX_ROOT_CAUSE)
        mock_check_seer_credits.assert_not_called()

    @with_feature("organizations:seer-credit-checks")
    @patch(
        "sentry.quotas.backend.check_seer_credits",
        return_value=HasSeerCreditsResponse(has_enough_credits=False),
    )
    def test_can_run_seer_operation_returns_false_when_billing_has_no_credits(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert not can_run_seer_operation(self.organization, SeerOperation.AUTOFIX_ROOT_CAUSE)
        mock_check_seer_credits.assert_called_once_with(
            HasSeerCreditsRequest(
                organization_id=self.organization.id,
                feature_id="autofix",
                predicted_credit_usage=SEER_OPERATIONS[SeerOperation.AUTOFIX_ROOT_CAUSE].estimate(),
                take_lease=False,
            )
        )

    @with_feature("organizations:seer-credit-checks")
    @patch(
        "sentry.quotas.backend.check_seer_credits",
        return_value=HasSeerCreditsResponse(has_enough_credits=True),
    )
    def test_can_run_seer_operation_returns_true_when_billing_has_credits(
        self, mock_check_seer_credits: MagicMock
    ) -> None:
        assert can_run_seer_operation(self.organization, SeerOperation.AGENT_CHAT_MESSAGE)
