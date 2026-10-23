from __future__ import annotations

import abc
from collections.abc import Sequence

from django.contrib.auth.models import AnonymousUser

from sentry.auth.access import Access
from sentry.investigations.contracts import ActionPayloadSerializer
from sentry.investigations.models import Investigation, InvestigationActionRequest
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ActionKind(abc.ABC):
    """Everything Sentry needs to check, apply, and record one kind of action."""

    kind: str
    payload_serializer: type[ActionPayloadSerializer]

    def cannot_apply_reasons(
        self,
        action_requests: Sequence[InvestigationActionRequest],
        *,
        investigations: dict[int, Investigation],
        access: Access | None,
        user: User | RpcUser | AnonymousUser,
    ) -> dict[int, str | None]:
        """For each suggested request, why the viewer can't apply it, or None if they can."""
        return {item.id: "unsupported_action" for item in action_requests}

    def after_upsert(self, action_request: InvestigationActionRequest) -> None:
        """Runs after Seer creates or changes a live request, inside the same transaction."""
