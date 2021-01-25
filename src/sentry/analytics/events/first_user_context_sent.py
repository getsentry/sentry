from sentry import analytics


class FirstUserContextSentEvent(analytics.Event):
    type = "first_user_context.sent"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
    )


analytics.register(FirstUserContextSentEvent)
