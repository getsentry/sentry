from sentry import analytics


class SentryAppUpdatedEvent(analytics.Event):
    type = "sentry_app.updated"

    attributes = (analytics.Attribute("user_id"), analytics.Attribute("sentry_app"))


analytics.register(SentryAppUpdatedEvent)
