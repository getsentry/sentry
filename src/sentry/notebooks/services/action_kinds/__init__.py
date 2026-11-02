from __future__ import annotations

from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookActionRequestState,
    NotebookStatus,
)
from sentry.notebooks.services.action_kinds.base import ActionKind, CannotApplyReason

ACTION_KINDS: dict[str, ActionKind] = {}


def register_action_kind(kind: ActionKind) -> None:
    ACTION_KINDS[kind.kind] = kind


def get_action_kind(kind: str | None) -> ActionKind | None:
    return ACTION_KINDS.get(kind) if kind is not None else None


def shared_cannot_apply_reason(
    investigation: Notebook, action_request: NotebookActionRequest
) -> CannotApplyReason | None:
    """Why no one can apply this request, whatever its kind, or None if its kind decides."""
    if investigation.status == NotebookStatus.ARCHIVED:
        return CannotApplyReason.INVESTIGATION_ARCHIVED
    if action_request.state != NotebookActionRequestState.SUGGESTED:
        return CannotApplyReason.NOT_SUGGESTED
    if get_action_kind(action_request.action_kind) is None:
        return CannotApplyReason.UNSUPPORTED_ACTION
    return None
