from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum

from sentry import features, quotas
from sentry.models.organization import Organization


class SeerOperation(StrEnum):
    AGENT_CHAT_MESSAGE = "agent_chat_message"
    AUTOFIX_ROOT_CAUSE = "autofix_root_cause"
    AUTOFIX_SOLUTION = "autofix_solution"
    AUTOFIX_CODE_CHANGES = "autofix_code_changes"
    AUTOFIX_PR_ITERATION = "autofix_pr_iteration"


class SeerFeature(StrEnum):
    """Seer features as tagged on LLM proxy calls, which billing maps to data categories."""

    AUTOFIX = "autofix"
    EXPLORER = "explorer"


@dataclass(frozen=True)
class SeerOperationConfig:
    feature: SeerFeature
    estimate: Callable[[Organization], int]


# TODO(CW-2314): Fake value until we have real estimates.
PLACEHOLDER_CREDIT_ESTIMATE = 100


SEER_OPERATIONS: dict[SeerOperation, SeerOperationConfig] = {
    SeerOperation.AGENT_CHAT_MESSAGE: SeerOperationConfig(
        SeerFeature.EXPLORER, lambda org: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_ROOT_CAUSE: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda org: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_SOLUTION: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda org: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_CODE_CHANGES: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda org: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_PR_ITERATION: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda org: PLACEHOLDER_CREDIT_ESTIMATE
    ),
}


def estimate_credits(organization: Organization, operation: SeerOperation) -> int:
    """Estimated Seer credits needed to run the operation for the organization."""
    return SEER_OPERATIONS[operation].estimate(organization)


def has_seer_credits(organization: Organization, operation: SeerOperation) -> bool:
    """Whether the organization has enough Seer credits to run the operation."""
    if not (
        features.has("organizations:seer-credit-checks", organization)
        and features.has("organizations:token-billed-seer-enabled", organization)
    ):
        return True

    return quotas.backend.has_seer_credits(
        org_id=organization.id,
        feature_id=SEER_OPERATIONS[operation].feature.value,
        predicted_credit_usage=estimate_credits(organization, operation),
    )
