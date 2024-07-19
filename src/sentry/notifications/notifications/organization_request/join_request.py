from __future__ import annotations

from sentry.integrations.types import ExternalProviders
from sentry.notifications.class_manager import register
from sentry.types.actor import Actor

from .abstract_invite_request import AbstractInviteRequestNotification


@register()
class JoinRequestNotification(AbstractInviteRequestNotification):
    analytics_event = "join_request.sent"
    metrics_key = "join_request"
    template_path = "sentry/emails/organization-join-request"

    def build_attachment_title(self, recipient: Actor) -> str:
        return "Request to Join"

    def get_message_description(self, recipient: Actor, provider: ExternalProviders) -> str:
        return f"{self.pending_member.email} is requesting to join {self.organization.name}"
