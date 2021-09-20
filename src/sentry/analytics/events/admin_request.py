from sentry import analytics


class InviteRequestSent(analytics.Event):
    type = "admin_request.sent"
    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("target_user_id"),
        analytics.Attribute("providers"),
        analytics.Attribute("ty"),
        analytics.Attribute("subtype", required=False),
    )


analytics.register(InviteRequestSent)
