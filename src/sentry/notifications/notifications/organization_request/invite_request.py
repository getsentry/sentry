from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.integrations.types import ExternalProviders
from sentry.notifications.class_manager import register
from sentry.types.actor import Actor

from .abstract_invite_request import AbstractInviteRequestNotification


@register()
class InviteRequestNotification(AbstractInviteRequestNotification):
    analytics_event = "invite_request.sent"
    metrics_key = "invite_request"
    template_path = "sentry/emails/organization-invite-request"

    def get_context(self):
        return {"organization": self.organization}

    def build_attachment_title(self, recipient: Actor) -> str:
        return "Request to Invite"

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return "Request to Invite New Member"

    def get_message_description(self, recipient: Actor, provider: ExternalProviders) -> str:
        requester_name = self.requester.get_display_name()
        return f"{requester_name} is requesting to invite {self.pending_member.email} into {self.organization.name}"
