from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.notifications.class_manager import register

from .abstract_invite_request import AbstractInviteRequestNotification

if TYPE_CHECKING:
    from sentry.models import Team, User


@register()
class JoinRequestNotification(AbstractInviteRequestNotification):
    analytics_event = "join_request.sent"
    referrer_base = "join_request"

    def get_filename(self) -> str:
        return "organization-join-request"

    def build_attachment_title(self, recipient: Team | User) -> str:
        return "Request to Join"

    def get_message_description(self, recipient: Team | User) -> str:
        return f"{self.pending_member.email} is requesting to join {self.organization.name}"
