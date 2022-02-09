from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.notifications.class_manager import register

from .abstract_invite_request import AbstractInviteRequestNotification

if TYPE_CHECKING:
    from sentry.models import Team, User


@register()
class InviteRequestNotification(AbstractInviteRequestNotification):
    analytics_event = "invite_request.sent"
    referrer_base = "invite_request"

    def get_filename(self) -> str:
        return "organization-invite-request"

    def build_attachment_title(self, recipient: Team | User) -> str:
        return "Request to Invite"

    def get_message_description(self, recipient: Team | User) -> str:
        requester_name = self.requester.get_display_name()
        return f"{requester_name} is requesting to invite {self.pending_member.email} into {self.organization.name}"
