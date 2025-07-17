from sentry import analytics


@analytics.eventclass("sentry_app_installation_token.deleted")
class SentryAppInstallationTokenDeleted(analytics.Event):
    user_id: int | None
    organization_id: int
    sentry_app_installation_id: int
    sentry_app: str


analytics.register(SentryAppInstallationTokenDeleted)
