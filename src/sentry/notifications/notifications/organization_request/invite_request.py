from __future__ import annotations
from typing import int

from sentry import analytics
from sentry.analytics.events.inapp_request import InviteRequestSentEvent
from sentry.integrations.types import ExternalProviders
from sentry.notifications.class_manager import register
from sentry.types.actor import Actor

from .abstract_invite_request import AbstractInviteRequestNotification


@register()
class InviteRequestNotification(AbstractInviteRequestNotification):
    metrics_key = "invite_request"
    template_path = "sentry/emails/organization-invite-request"

    def get_specific_analytics_event(self, provider: ExternalProviders) -> analytics.Event | None:
        """
        Returns the specific analytics event for the provider.
        """
        return InviteRequestSentEvent(
            organization_id=self.organization.id,
            user_id=self.requester.id,
            target_user_id=self.pending_member.id,
            providers=provider.name.lower() if provider.name else "",
            subtype=self.metrics_key,
            invited_member_id=self.pending_member.id,
        )

    def build_attachment_title(self, recipient: Actor) -> str:
        return "Request to Invite"

    def get_message_description(self, recipient: Actor, provider: ExternalProviders) -> str:
        requester_name = self.requester.get_display_name()
        return f"{requester_name} is requesting to invite {self.pending_member.email} into {self.organization.name}"
