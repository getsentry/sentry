from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from sentry.preprod.models import PreprodComparisonApproval
from sentry.preprod.snapshots.constants import MISSING_BASE_GRACE_PERIOD_SECONDS
from sentry.preprod.snapshots.models import PreprodSnapshotComparison

ComparisonStateLiteral = Literal[
    "pending", "processing", "success", "failed", "waiting_for_base", "no_base_build"
]
ApprovalStatusLiteral = Literal["approved", "auto_approved", "requires_approval"]


@dataclass(frozen=True)
class SnapshotStatusInput:
    latest_comparison: PreprodSnapshotComparison | None
    latest_approval: PreprodComparisonApproval | None
    has_base_sha: bool
    artifact_age_seconds: float
    base_artifact_exists: bool | None


class SnapshotDerivedStatus(BaseModel):
    comparison_state: ComparisonStateLiteral | None = None
    approval_status: ApprovalStatusLiteral | None = None
    comparison_error_message: str | None = None


def derive_snapshot_status(status_input: SnapshotStatusInput) -> SnapshotDerivedStatus:
    comparison_state = None
    comparison_error_message = None

    if status_input.latest_comparison is not None:
        comparison_state = PreprodSnapshotComparison.State(
            status_input.latest_comparison.state
        ).name.lower()
        if status_input.latest_comparison.state == PreprodSnapshotComparison.State.FAILED:
            comparison_error_message = status_input.latest_comparison.error_message
    elif status_input.has_base_sha:
        grace_period_expired = status_input.artifact_age_seconds > MISSING_BASE_GRACE_PERIOD_SECONDS
        if grace_period_expired and status_input.base_artifact_exists is False:
            comparison_state = "no_base_build"
        else:
            comparison_state = "waiting_for_base"

    approval_status = None
    if status_input.latest_approval is not None:
        if (
            status_input.latest_approval.approval_status
            == PreprodComparisonApproval.ApprovalStatus.APPROVED
        ):
            if (status_input.latest_approval.extras or {}).get("auto_approval") is True:
                approval_status = "auto_approved"
            else:
                approval_status = "approved"
        else:
            approval_status = "requires_approval"

    return SnapshotDerivedStatus(
        comparison_state=comparison_state,
        comparison_error_message=comparison_error_message,
        approval_status=approval_status,
    )
