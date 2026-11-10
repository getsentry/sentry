from __future__ import annotations

from collections.abc import Callable
from enum import StrEnum

from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsRequest,
)

from sentry import features, seer_credit
from sentry.models.organization import Organization


class SeerOperation(StrEnum):
    AGENT_CHAT_MESSAGE = "agent_chat_message"
    AUTOFIX_ROOT_CAUSE = "autofix_root_cause"
    AUTOFIX_SOLUTION = "autofix_solution"
    AUTOFIX_CODE_CHANGES = "autofix_code_changes"
    AUTOFIX_OPEN_PR = "autofix_open_pr"
    AUTOFIX_PR_ITERATION = "autofix_pr_iteration"
    AUTOFIX_SINGLE_RUN_REPLY = "autofix_single_run_reply"


class SeerBillingFeature(StrEnum):
    """Seer features as tagged on LLM proxy calls, which billing maps to data categories."""

    AGENTIC_TRIAGE = "agentic_triage"  # Marks the Autofix runs agentic triage starts.
    AUTOFIX = "autofix"
    EXPLORER = "explorer"


# TODO(CW-2314): Fake value until we have real estimates.
PLACEHOLDER_CREDIT_ESTIMATE = 100


# The operation sets the estimate. Callers pass the feature, since an operation can run under
# more than one feature.
SEER_OPERATION_ESTIMATES: dict[SeerOperation, Callable[[], int]] = {
    SeerOperation.AGENT_CHAT_MESSAGE: lambda: PLACEHOLDER_CREDIT_ESTIMATE,
    SeerOperation.AUTOFIX_ROOT_CAUSE: lambda: PLACEHOLDER_CREDIT_ESTIMATE,
    SeerOperation.AUTOFIX_SOLUTION: lambda: PLACEHOLDER_CREDIT_ESTIMATE,
    SeerOperation.AUTOFIX_CODE_CHANGES: lambda: PLACEHOLDER_CREDIT_ESTIMATE,
    SeerOperation.AUTOFIX_OPEN_PR: lambda: PLACEHOLDER_CREDIT_ESTIMATE,
    SeerOperation.AUTOFIX_PR_ITERATION: lambda: PLACEHOLDER_CREDIT_ESTIMATE,
    SeerOperation.AUTOFIX_SINGLE_RUN_REPLY: lambda: PLACEHOLDER_CREDIT_ESTIMATE,
}


def has_enough_seer_credits(
    organization: Organization, feature: SeerBillingFeature, operation: SeerOperation
) -> bool:
    """
    Checks whether the organization has enough Seer credits to run the operation,
    for callers that already checked the credit check and token-billed flags.
    """
    response = seer_credit.backend.check_seer_credits(
        CheckSeerCreditsRequest(
            organization_id=organization.id,
            feature_id=feature.value,
            predicted_credit_usage=SEER_OPERATION_ESTIMATES[operation](),
            take_lease=False,
        )
    )
    return response.has_enough_credits


def can_run_seer_operation(
    organization: Organization, feature: SeerBillingFeature, operation: SeerOperation
) -> bool:
    """
    Checks whether the organization is token-billed and has enough Seer credits to run the operation.
    """
    if not features.has("organizations:seer-credit-checks", organization) or not features.has(
        "organizations:token-billed-seer-enabled", organization
    ):
        return True
    return has_enough_seer_credits(organization, feature, operation)
