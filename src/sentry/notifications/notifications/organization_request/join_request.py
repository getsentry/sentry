from __future__ import annotations

from sentry.notifications.class_manager import register
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

from .abstract_invite_request import AbstractInviteRequestNotification


@register()
class JoinRequestNotification(AbstractInviteRequestNotification):
    analytics_event = "join_request.sent"
    metrics_key = "join_request"
    template_path = "sentry/emails/organization-join-request"

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return "Request to Join"

    def get_message_description(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        return f"{self.pending_member.email} is requesting to join {self.organization.name}"
