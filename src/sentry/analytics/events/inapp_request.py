from sentry import analytics


class InAppRequestSent(analytics.Event):
    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("target_user_id"),
        analytics.Attribute("providers"),
        analytics.Attribute("subtype", required=False),
    )


class InviteRequestSent(InAppRequestSent):
    type = "invite_request.sent"


analytics.register(InviteRequestSent)
