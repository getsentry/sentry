from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
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


class SeerFeature(StrEnum):
    """Seer features as tagged on LLM proxy calls, which billing maps to data categories."""

    AGENTIC_TRIAGE = "agentic_triage"  # Not billed yet. Marks the Autofix runs it starts.
    AUTOFIX = "autofix"
    EXPLORER = "explorer"


@dataclass(frozen=True)
class SeerOperationConfig:
    feature: SeerFeature
    estimate: Callable[[], int]


# TODO(CW-2314): Fake value until we have real estimates.
PLACEHOLDER_CREDIT_ESTIMATE = 100


SEER_OPERATIONS: dict[SeerOperation, SeerOperationConfig] = {
    SeerOperation.AGENT_CHAT_MESSAGE: SeerOperationConfig(
        SeerFeature.EXPLORER, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_ROOT_CAUSE: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_SOLUTION: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_CODE_CHANGES: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_OPEN_PR: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_PR_ITERATION: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_SINGLE_RUN_REPLY: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
}


def has_enough_seer_credits(organization: Organization, operation: SeerOperation) -> bool:
    """
    Checks whether the organization has enough Seer credits to run the operation,
    for callers that already checked the credit check and token-billed flags.
    """
    config = SEER_OPERATIONS[operation]
    response = seer_credit.backend.check_seer_credits(
        CheckSeerCreditsRequest(
            organization_id=organization.id,
            feature_id=config.feature.value,
            predicted_credit_usage=config.estimate(),
            take_lease=False,
        )
    )
    return response.has_enough_credits


def can_run_seer_operation(organization: Organization, operation: SeerOperation) -> bool:
    """Checks whether the organization is token-billed and has enough Seer credits to run the operation."""
    if not features.has("organizations:seer-credit-checks", organization) or not features.has(
        "organizations:token-billed-seer-enabled", organization
    ):
        return True
    return has_enough_seer_credits(organization, operation)
