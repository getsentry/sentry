import abc

from sentry import analytics


class InAppRequestSentEvent(analytics.Event, abc.ABC):
    attributes = [
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("target_user_id"),
        analytics.Attribute("providers"),
        analytics.Attribute("subtype", required=False),
    ]


class InviteOrJoinRequest(InAppRequestSentEvent, abc.ABC):
    attributes = InAppRequestSentEvent.attributes + [analytics.Attribute("invited_member_id")]


class InviteRequestSentEvent(InviteOrJoinRequest):
    type = "invite_request.sent"


class JoinRequestSentEvent(InviteOrJoinRequest):
    type = "join_request.sent"


analytics.register(InviteRequestSentEvent)
analytics.register(JoinRequestSentEvent)
