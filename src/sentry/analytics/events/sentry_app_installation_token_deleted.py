from sentry import analytics


@analytics.eventclass("sentry_app_installation_token.deleted")
class SentryAppInstallationTokenDeleted(analytics.Event):
    user_id: str
    organization_id: str
    sentry_app_installation_id: str
    sentry_app: str


analytics.register(SentryAppInstallationTokenDeleted)
