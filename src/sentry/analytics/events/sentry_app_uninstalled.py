from sentry import analytics


@analytics.eventclass("sentry_app.uninstalled")
class SentryAppUninstalledEvent(analytics.Event):
    user_id: str
    organization_id: str
    sentry_app: str


analytics.register(SentryAppUninstalledEvent)
