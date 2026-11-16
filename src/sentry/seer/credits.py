from __future__ import annotations

from collections.abc import Callable
from enum import StrEnum

from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_check_seer_credits_pb2 import (
    CheckSeerCreditsRequest,
    CheckSeerCreditsResponse,
)

from sentry import features, seer_credit
from sentry.models.organization import Organization

# Seer's failure_reason and pr_creation_error_code when the org ran out of credits.
OUT_OF_CREDITS = "out_of_credits"


class SeerOperation(StrEnum):
    AGENT_CHAT_MESSAGE = "agent_chat_message"
    AUTOFIX_ROOT_CAUSE = "autofix_root_cause"
    AUTOFIX_SOLUTION = "autofix_solution"
    AUTOFIX_CODE_CHANGES = "autofix_code_changes"
    AUTOFIX_OPEN_PR = "autofix_open_pr"
    AUTOFIX_PR_ITERATION = "autofix_pr_iteration"
    AUTOFIX_SINGLE_RUN_REPLY = "autofix_single_run_reply"


class SeerFeature(StrEnum):
    """Seer features as tagged on LLM proxy calls, which billing maps to data categories."""

    AUTOFIX = "autofix"
    EXPLORER = "explorer"


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


def has_enough_seer_credits(
    organization: Organization, feature: SeerFeature, operation: SeerOperation
) -> bool:
    """
    Checks whether the organization has enough Seer credits to run the operation,
    for callers that already checked the credit check and token-billed flags.
    """
    return _check_seer_credits(organization, feature, operation).has_enough_credits


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
