from sentry import analytics


@analytics.eventclass("sentry_app_installation.updated")
class SentryAppInstallationUpdatedEvent(analytics.Event):
    sentry_app_installation_id: str
    sentry_app_id: str
    organization_id: str


analytics.register(SentryAppInstallationUpdatedEvent)
