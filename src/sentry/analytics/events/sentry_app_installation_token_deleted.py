from sentry import analytics


class SentryAppInstallationTokenDeleted(analytics.Event):
    type = "sentry_app_installation_token.deleted"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("sentry_app_installation_id"),
        analytics.Attribute("sentry_app"),
    )


analytics.register(SentryAppInstallationTokenDeleted)
