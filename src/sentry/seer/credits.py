from __future__ import annotations

from collections.abc import Callable
from enum import StrEnum
from typing import Literal

from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsRequest,
    CheckSeerCreditsResponse,
)

from sentry import features, seer_credit
from sentry.models.organization import Organization

# Seer's failure_reason and pr_creation_error_code when the org ran out of credits.
OUT_OF_CREDITS = "out_of_credits"


SeerCreditDenialReason = Literal["not_enough_credits", "daily_cap_exceeded"]

# Unspecified and unknown reasons map to None, so a reason added to the proto
# before this mapping doesn't leak an enum name into the API.
_DENIAL_REASONS: dict[CheckSeerCreditsResponse.DenialReason.ValueType, SeerCreditDenialReason] = {
    CheckSeerCreditsResponse.DENIAL_REASON_NOT_ENOUGH_CREDITS: "not_enough_credits",
    CheckSeerCreditsResponse.DENIAL_REASON_DAILY_CAP_EXCEEDED: "daily_cap_exceeded",
}


class SeerOperation(StrEnum):
    AGENT_CHAT_MESSAGE = "agent_chat_message"
    AUTOFIX_ROOT_CAUSE = "autofix_root_cause"
    AUTOFIX_SOLUTION = "autofix_solution"
    AUTOFIX_CODE_CHANGES = "autofix_code_changes"
    AUTOFIX_OPEN_PR = "autofix_open_pr"
    AUTOFIX_PR_ITERATION = "autofix_pr_iteration"
    AUTOFIX_SINGLE_RUN_REPLY = "autofix_single_run_reply"


class SeerFeature(StrEnum):
    """Seer billing labels, which billing maps to data categories."""

    AUTOFIX_WEB = "autofix_web"
    AUTOFIX_HEADLESS = "autofix_headless"
    AUTOFIX_INTEGRATIONS = "autofix_integrations"
    AUTOFIX_POST_PROCESS = "autofix_post_process"
    AUTOFIX_AGENTIC_TRIAGE = "autofix_agentic_triage"
    SEER_AGENT = "seer_agent"
    SEER_AGENT_SLACK = "seer_agent_slack"


# Credits an operation is expected to use, about the p90 of what one costs. A credit is one cent.
# The operation sets the estimate. Callers pass the feature, since an operation can run under
# more than one feature.
SEER_OPERATION_ESTIMATES: dict[SeerOperation, Callable[[], int]] = {
    SeerOperation.AGENT_CHAT_MESSAGE: lambda: 40,
    SeerOperation.AUTOFIX_ROOT_CAUSE: lambda: 75,
    SeerOperation.AUTOFIX_SOLUTION: lambda: 45,
    SeerOperation.AUTOFIX_CODE_CHANGES: lambda: 75,
    SeerOperation.AUTOFIX_OPEN_PR: lambda: 15,
    SeerOperation.AUTOFIX_PR_ITERATION: lambda: 90,
    # TODO(CW-3067): No cost data for single runs yet. A reply is one more turn on a run that
    # already has code, like a PR iteration, so it uses the same estimate.
    SeerOperation.AUTOFIX_SINGLE_RUN_REPLY: lambda: 90,
}


def _check_seer_credits(
    organization: Organization, feature: SeerFeature, operation: SeerOperation
) -> CheckSeerCreditsResponse:
    return seer_credit.backend.check_seer_credits(
        CheckSeerCreditsRequest(
            organization_id=organization.id,
            feature_id=feature.value,
            predicted_credit_usage=SEER_OPERATION_ESTIMATES[operation](),
            take_lease=False,
        )
    )


def check_seer_operation(
    organization: Organization, feature: SeerFeature, operation: SeerOperation
) -> CheckSeerCreditsResponse:
    """Checks whether the organization is token-billed and has enough Seer credits to run the operation."""
    if not features.has("organizations:seer-credit-checks", organization) or not features.has(
        "organizations:token-billed-seer-enabled", organization
    ):
        return CheckSeerCreditsResponse(has_enough_credits=True)
    return _check_seer_credits(organization, feature, operation)


def can_run_seer_operation(
    organization: Organization, feature: SeerFeature, operation: SeerOperation
) -> bool:
    return check_seer_operation(organization, feature, operation).has_enough_credits


def get_denial_reason(response: CheckSeerCreditsResponse) -> SeerCreditDenialReason | None:
    return _DENIAL_REASONS.get(response.denial_reason)
