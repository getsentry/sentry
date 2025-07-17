from sentry import analytics


@analytics.eventclass("member.invited")
class MemberInvitedEvent(analytics.Event):
    inviter_user_id: int | None
    invited_member_id: int
    organization_id: str
    referrer: str | None = None


analytics.register(MemberInvitedEvent)
