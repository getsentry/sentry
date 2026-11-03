from __future__ import annotations

from enum import StrEnum
from typing import Any, NotRequired, TypedDict, cast

from sentry.integrations.services.repository.constants import (
    GITLAB_WEBHOOK_RECONCILIATION_KEY,
)


class GitLabWebhookReconciliationStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    FAILED = "failed"


class GitLabWebhookReconciliationState(TypedDict):
    status: str
    generation: str
    integration_id: int
    scheduled_at: float
    claim_token: NotRequired[str]
    claimed_at: NotRequired[float]
    failure_reason: NotRequired[str]


def pending_reconciliation_state(
    *, generation: str, integration_id: int, scheduled_at: float
) -> GitLabWebhookReconciliationState:
    return {
        "status": GitLabWebhookReconciliationStatus.PENDING,
        "generation": generation,
        "integration_id": integration_id,
        "scheduled_at": scheduled_at,
    }


def get_reconciliation_state(
    config: dict[str, Any], *, integration_id: int
) -> GitLabWebhookReconciliationState | None:
    value = config.get(GITLAB_WEBHOOK_RECONCILIATION_KEY)
    if not isinstance(value, dict):
        return None
    if value.get("integration_id") != integration_id:
        return None
    if not isinstance(value.get("generation"), str):
        return None
    status = value.get("status")
    if status not in {
        GitLabWebhookReconciliationStatus.PENDING,
        GitLabWebhookReconciliationStatus.IN_PROGRESS,
        GitLabWebhookReconciliationStatus.FAILED,
    }:
        return None
    if not isinstance(value.get("scheduled_at"), int | float):
        return None
    if status == GitLabWebhookReconciliationStatus.IN_PROGRESS and not isinstance(
        value.get("claimed_at"), int | float
    ):
        return None
    return cast(GitLabWebhookReconciliationState, value)
