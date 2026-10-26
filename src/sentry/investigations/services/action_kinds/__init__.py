from __future__ import annotations

from sentry.investigations.models import (
    Investigation,
    InvestigationActionRequest,
    InvestigationActionRequestState,
    InvestigationStatus,
)
from sentry.investigations.services.action_kinds.base import ActionKind, CannotApplyReason
from sentry.investigations.services.action_kinds.connect_telemetry import ConnectTelemetryKind
from sentry.investigations.services.action_kinds.update_detector import (
    UpdateDetectorAppliedDetails,
    UpdateDetectorKind,
)

AppliedDetails = UpdateDetectorAppliedDetails

ACTION_KINDS: dict[str, ActionKind] = {
    kind.kind: kind for kind in (UpdateDetectorKind(), ConnectTelemetryKind())
}


def get_action_kind(kind: str | None) -> ActionKind | None:
    return ACTION_KINDS.get(kind) if kind is not None else None


def shared_cannot_apply_reason(
    investigation: Investigation, action_request: InvestigationActionRequest
) -> CannotApplyReason | None:
    """Why no one can apply this request, whatever its kind, or None if its kind decides."""
    if investigation.status == InvestigationStatus.ARCHIVED:
        return CannotApplyReason.INVESTIGATION_ARCHIVED
    if action_request.state != InvestigationActionRequestState.SUGGESTED:
        return CannotApplyReason.NOT_SUGGESTED
    if get_action_kind(action_request.action_kind) is None:
        return CannotApplyReason.UNSUPPORTED_ACTION
    return None
