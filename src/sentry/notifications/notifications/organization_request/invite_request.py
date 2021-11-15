from .abstract_invite_request import AbstractInviteRequestNotification


class InviteRequestNotification(AbstractInviteRequestNotification):
    analytics_event = "invite_request.sent"
    referrer_base = "invite_request"

    def get_filename(self) -> str:
        return "organization-invite-request"

    def build_attachment_title(self) -> str:
        return "Request to Invite"

    def get_message_description(self) -> str:
        requester_name = self.requester.get_display_name()
        return f"{requester_name} is requesting to invite {self.pending_member.email} into {self.organization.name}"
