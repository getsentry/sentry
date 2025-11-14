from typing import int
from sentry import analytics


@analytics.eventclass("sentry_app.uninstalled")
class SentryAppUninstalledEvent(analytics.Event):
    user_id: int
    organization_id: int
    sentry_app: str


analytics.register(SentryAppUninstalledEvent)
