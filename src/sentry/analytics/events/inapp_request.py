from typing import int
import abc

from sentry import analytics


@analytics.eventclass()
class InAppRequestSentEvent(analytics.Event, abc.ABC):
    organization_id: int
    user_id: int | None = None
    target_user_id: int
    providers: str
    subtype: str | None = None


@analytics.eventclass()
class InviteOrJoinRequest(InAppRequestSentEvent, abc.ABC):
    invited_member_id: int


@analytics.eventclass("invite_request.sent")
class InviteRequestSentEvent(InviteOrJoinRequest):
    pass


@analytics.eventclass("join_request.sent")
class JoinRequestSentEvent(InviteOrJoinRequest):
    pass


analytics.register(InviteRequestSentEvent)
analytics.register(JoinRequestSentEvent)
