from sentry import analytics


class SentryAppCreatedEvent(analytics.Event):
    type = "sentry_app.created"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("sentry_app"),
    )


analytics.register(SentryAppCreatedEvent)
