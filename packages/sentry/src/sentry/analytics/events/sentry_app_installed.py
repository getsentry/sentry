from sentry import analytics


class SentryAppInstalledEvent(analytics.Event):
    type = "sentry_app.installed"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("sentry_app"),
    )


analytics.register(SentryAppInstalledEvent)
