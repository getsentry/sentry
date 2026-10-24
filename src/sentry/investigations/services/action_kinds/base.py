from __future__ import annotations

import abc
from collections.abc import Sequence
from enum import StrEnum

from django.contrib.auth.models import AnonymousUser

from sentry.auth.access import Access
from sentry.investigations.contracts import ActionPayloadSerializer
from sentry.investigations.models import Investigation, InvestigationActionRequest
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

    def after_upsert(self, action_request: InvestigationActionRequest) -> None:
        """Runs when Seer creates or changes a request, in the same transaction. Only requests
        that are still suggested once the whole event is handled get it.
        """
