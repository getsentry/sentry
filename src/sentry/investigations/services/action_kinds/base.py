from __future__ import annotations

import abc
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Literal, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request

from sentry.auth.access import Access
from sentry.investigations.contracts import ActionPayloadSerializer
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.notebooks.models import Notebook, NotebookActionRequest
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class CannotApplyReason(StrEnum):
    """Why the viewer can't apply a request. The UI switches on these."""

    INVESTIGATION_ARCHIVED = "investigation_archived"
    NOT_SUGGESTED = "not_suggested"
    UNSUPPORTED_ACTION = "unsupported_action"
    NO_ACCESS = "no_access"
    NOT_TARGET_DETECTOR = "not_target_detector"
    DETECTOR_NOT_FOUND = "detector_not_found"
    PERMISSION_DENIED = "permission_denied"
    DYNAMIC_DETECTOR = "dynamic_detector"


# One setting an action reads or changes, as JSON.
SettingValue = int | float | str | None


class ApplyErrorCode(StrEnum):
    """What else the apply endpoint can say went wrong. The UI switches on these."""

    ALREADY_APPLIED = "already_applied"
    WITHDRAWN = "withdrawn"
    STALE = "stale"
    VALIDATION_FAILED = "validation_failed"
    ACTION_CHANGED = "action_changed"
    NOT_STALE = "not_stale"
    NOT_RETRYABLE = "not_retryable"


class ApplyError(TypedDict):
    detail: str
    code: CannotApplyReason | ApplyErrorCode
    # Seer's reason for withdrawing it.
    reason: NotRequired[str | None]
    # The settings that moved since Seer suggested the change.
    current: NotRequired[dict[str, SettingValue]]
    # Why the change wouldn't save.
    messages: NotRequired[list[str]]


class ActionRequestError(TypedDict):
    """What's stored on a request that went wrong, and shown with it."""

    code: ApplyErrorCode
    current: NotRequired[dict[str, SettingValue]]
    messages: NotRequired[list[str]]


class ApplyFailed(Exception):
    def __init__(self, error: ApplyError) -> None:
        super().__init__(error["detail"])
        self.error = error


@dataclass(frozen=True)
class ApplyContext:
    """When applying, the caller holds the investigation, run, and request row locks."""

    investigation: Notebook
    run: InvestigationOrchestrationRun
    action_request: NotebookActionRequest
    request: Request
    actor_id: int


FollowUpCommandType = Literal["recheck_action_requests", "rerun_after_connection"]


class FollowUpCommand(TypedDict):
    """A command Sentry sends Seer for an action request."""

    type: FollowUpCommandType
    payload: dict[str, Any]


class ActionStale(Exception):
    """What the action changes moved since Seer suggested it."""

    def __init__(self, current: dict[str, SettingValue]) -> None:
        super().__init__("The action is stale.")
        self.current = current


class ActionInvalid(Exception):
    """The change wouldn't save, and why."""

    def __init__(self, messages: list[str]) -> None:
        super().__init__("The action is invalid.")
        self.messages = messages


class ActionKind(abc.ABC):
    """Everything Sentry needs to check, apply, and record one kind of action."""

    kind: str
    payload_serializer: type[ActionPayloadSerializer]

    def cannot_apply_reasons(
        self,
        action_requests: Sequence[NotebookActionRequest],
        *,
        investigations: dict[int, Notebook],
        access: Access,
        user: User | RpcUser | AnonymousUser,
    ) -> dict[int, CannotApplyReason | None]:
        """For each suggested request, why the viewer can't apply it, or None if they can."""
        return {item.id: CannotApplyReason.UNSUPPORTED_ACTION for item in action_requests}

    def check_remote(self, investigation: Notebook, action_request: NotebookActionRequest) -> None:
        """Checks that ask another silo, for a request the viewer can apply. They run before
        apply and its dry run take locks, since a silo call can't run in a transaction. Raise
        ActionInvalid where apply would.
        """

    def check(self, context: ApplyContext) -> None:
        """Run the checks apply would, without changing anything. Raise ActionStale or
        ActionInvalid where apply would. Kinds with nothing to check beyond
        cannot_apply_reasons can leave this as is.
        """

    def apply(self, context: ApplyContext) -> Mapping[str, object]:
        """Make the change, and return what the activity feed should show about it. Raise
        ActionStale or ActionInvalid instead of updating the request; the caller records it.
        """
        raise NotImplementedError

    def follow_up_command(self, action_request: NotebookActionRequest) -> FollowUpCommand | None:
        """What to ask Seer to do once the request is applied, if anything."""
        return None

    def after_upsert(self, action_request: NotebookActionRequest) -> None:
        """Runs when Seer creates or changes a request, in the same transaction. Only requests
        that are still suggested once the whole event is handled get it.
        """
