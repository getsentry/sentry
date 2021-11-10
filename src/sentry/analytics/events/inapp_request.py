from sentry import analytics


class InAppRequestSentEvent(analytics.Event):
    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("target_user_id"),
        analytics.Attribute("providers"),
        analytics.Attribute("subtype", required=False),
    )


class InviteRequestSentEvent(InAppRequestSentEvent):
    type = "invite_request.sent"


class JoinRequestSentEvent(InAppRequestSentEvent):
    type = "join_request.sent"


analytics.register(InviteRequestSentEvent)
analytics.register(JoinRequestSentEvent)
