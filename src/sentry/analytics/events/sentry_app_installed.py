from typing import int
from sentry import analytics


@analytics.eventclass("sentry_app.installed")
class SentryAppInstalledEvent(analytics.Event):
    user_id: int
    organization_id: int
    sentry_app: str


analytics.register(SentryAppInstalledEvent)
