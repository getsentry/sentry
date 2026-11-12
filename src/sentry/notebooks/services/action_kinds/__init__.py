from __future__ import annotations

from collections.abc import Mapping
from typing import Union

from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookActionRequestState,
    NotebookStatus,
)
from sentry.notebooks.services.action_kinds.base import ActionKind, CannotApplyReason
from sentry.notebooks.services.producer import get_producer

ACTION_KINDS: dict[str, ActionKind[Mapping[str, object]]] = {}


def register_action_kind(kind: ActionKind[Mapping[str, object]]) -> None:
    existing = ACTION_KINDS.setdefault(kind.kind, kind)
    if type(existing) is not type(kind):
        raise ValueError(f"{kind.kind!r} is already registered: {type(existing).__name__}")


def get_action_kind(kind: str | None) -> ActionKind[Mapping[str, object]] | None:
    return ACTION_KINDS.get(kind) if kind is not None else None


def applied_details_hint() -> object:
    """Any registered kind's applied details, or None."""
    return Union[(*(kind.applied_details for kind in ACTION_KINDS.values()), None)]


def shared_cannot_apply_reason(
    notebook: Notebook, action_request: NotebookActionRequest
) -> CannotApplyReason | None:
    """Why no one can apply this request, whatever its kind, or None if its kind decides."""
    if notebook.status == NotebookStatus.ARCHIVED:
        return CannotApplyReason.NOTEBOOK_ARCHIVED
    if action_request.state != NotebookActionRequestState.SUGGESTED:
        return CannotApplyReason.NOT_SUGGESTED
    if get_producer(notebook.source_type) is None:
        return CannotApplyReason.UNSUPPORTED_ACTION
    if get_action_kind(action_request.action_kind) is None:
        return CannotApplyReason.UNSUPPORTED_ACTION
    return None
