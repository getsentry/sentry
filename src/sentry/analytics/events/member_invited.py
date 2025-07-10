from sentry import analytics


@analytics.eventclass("member.invited")
class MemberInvitedEvent(analytics.Event):
    inviter_user_id: str
    invited_member_id: str
    organization_id: str
    referrer: str | None = None


analytics.register(MemberInvitedEvent)
