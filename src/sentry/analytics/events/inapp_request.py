import abc

from sentry import analytics


@analytics.eventclass()
class InAppRequestSentEvent(analytics.Event, abc.ABC):
    organization_id: str
    user_id: str | None = None
    target_user_id: str
    providers: str
    subtype: str | None = None


@analytics.eventclass()
class InviteOrJoinRequest(InAppRequestSentEvent, abc.ABC):
    invited_member_id: str


@analytics.eventclass("invite_request.sent")
class InviteRequestSentEvent(InviteOrJoinRequest):
    pass


@analytics.eventclass("join_request.sent")
class JoinRequestSentEvent(InviteOrJoinRequest):
    pass


analytics.register(InviteRequestSentEvent)
analytics.register(JoinRequestSentEvent)
