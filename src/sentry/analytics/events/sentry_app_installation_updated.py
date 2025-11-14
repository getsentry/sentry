from typing import int
from sentry import analytics


@analytics.eventclass("sentry_app_installation.updated")
class SentryAppInstallationUpdatedEvent(analytics.Event):
    sentry_app_installation_id: int
    sentry_app_id: int
    organization_id: int


analytics.register(SentryAppInstallationUpdatedEvent)
