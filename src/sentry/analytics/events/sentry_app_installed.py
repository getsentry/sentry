from sentry import analytics


@analytics.eventclass("sentry_app.installed")
class SentryAppInstalledEvent(analytics.Event):
    user_id: str
    organization_id: str
    sentry_app: str


analytics.register(SentryAppInstalledEvent)
