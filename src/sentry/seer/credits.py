from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum

from sentry_protos.billing.v1.services.seer_feature_billing.v1.endpoint_has_seer_credits_pb2 import (
    HasSeerCreditsRequest,
)

from sentry import features, quotas
from sentry.models.organization import Organization


class SeerOperation(StrEnum):
    AGENT_CHAT_MESSAGE = "agent_chat_message"
    AUTOFIX_ROOT_CAUSE = "autofix_root_cause"
    AUTOFIX_SOLUTION = "autofix_solution"
    AUTOFIX_CODE_CHANGES = "autofix_code_changes"
    AUTOFIX_CREATE_PR = "autofix_create_pr"
    AUTOFIX_PR_ITERATION = "autofix_pr_iteration"


class SeerFeature(StrEnum):
    """Seer features as tagged on LLM proxy calls, which billing maps to data categories."""

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
    SeerOperation.AUTOFIX_CREATE_PR: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
    SeerOperation.AUTOFIX_PR_ITERATION: SeerOperationConfig(
        SeerFeature.AUTOFIX, lambda: PLACEHOLDER_CREDIT_ESTIMATE
    ),
}


def estimate_credits(operation: SeerOperation) -> int:
    """Estimated Seer credits needed to run the operation."""
    return SEER_OPERATIONS[operation].estimate()


def can_run_seer_operation(organization: Organization, operation: SeerOperation) -> bool:
    """Whether the organization has enough Seer credits to run the operation."""
    if not features.has("organizations:seer-credit-checks", organization):
        return True

    response = quotas.backend.check_seer_credits(
        HasSeerCreditsRequest(
            organization_id=organization.id,
            feature_id=SEER_OPERATIONS[operation].feature.value,
            predicted_credit_usage=estimate_credits(operation),
            take_lease=False,
        )
    )
    return response.has_enough_credits
