from .abstract_invite_request import AbstractInviteRequestNotification


class JoinRequestNotification(AbstractInviteRequestNotification):
    analytics_event = "join_request.sent"
    filename = "organization-join-request"
    referrer_base = "join_request"

    def build_attachment_title(self) -> str:
        return "Request to Join"

    def get_message_description(self) -> str:
        return f"{self.pending_member.email} is requesting to join {self.organization.name}"
