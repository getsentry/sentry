from __future__ import annotations

import abc
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from django.contrib.auth.models import AnonymousUser
from rest_framework import status
from rest_framework.request import Request

from sentry.auth.access import Access
from sentry.investigations.contracts import ActionPayloadSerializer
from sentry.investigations.models import (
    Investigation,
    InvestigationActionRequest,
    InvestigationOrchestrationRun,
)
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


@dataclass(frozen=True)
class ApplyResult:
    action_request: InvestigationActionRequest
    status: int = status.HTTP_200_OK
    error: dict[str, object] | None = None


@dataclass(frozen=True)
class ApplyContext:
    """When applying, the caller holds the investigation, run, and request row locks."""

    investigation: Investigation
    run: InvestigationOrchestrationRun
    action_request: InvestigationActionRequest
    request: Request
    actor_id: int


def apply_error(
    action_request: InvestigationActionRequest,
    status_code: int,
    detail: str,
    code: str,
    **extra: object,
) -> ApplyResult:
    return ApplyResult(
        action_request=action_request,
        status=status_code,
        error={"detail": detail, "code": code, **extra},
    )


def unsupported_action(action_request: InvestigationActionRequest) -> ApplyResult:
    return apply_error(
        action_request,
        status.HTTP_400_BAD_REQUEST,
        "This request has no action to apply.",
        "unsupported_action",
    )


class ActionKind(abc.ABC):
    """Everything Sentry needs to check, apply, and record one kind of action."""

    kind: str
    payload_serializer: type[ActionPayloadSerializer]

    def cannot_apply_reasons(
        self,
        action_requests: Sequence[InvestigationActionRequest],
        *,
        investigations: dict[int, Investigation],
        access: Access,
        user: User | RpcUser | AnonymousUser,
    ) -> dict[int, CannotApplyReason | None]:
        """For each suggested request, why the viewer can't apply it, or None if they can."""
        return {item.id: CannotApplyReason.UNSUPPORTED_ACTION for item in action_requests}

    def check(self, context: ApplyContext) -> ApplyResult | None:
        """Run the checks apply would, without changing anything. Returns the error apply would
        return, or None if it would apply. cannot_apply_reasons has already passed.
        """
        return unsupported_action(context.action_request)

    def apply(self, context: ApplyContext) -> ApplyResult:
        """Make the change. cannot_apply_reasons has already passed. If an error updates the row,
        return it rather than raise, so the update still commits.
        """

        return unsupported_action(context.action_request)

    def after_upsert(self, action_request: InvestigationActionRequest) -> None:
        """Runs when Seer creates or changes a request, in the same transaction. Only requests
        that are still suggested once the whole event is handled get it.
        """
