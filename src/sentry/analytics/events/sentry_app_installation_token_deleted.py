from typing import int
from sentry import analytics


@analytics.eventclass("sentry_app_installation_token.deleted")
class SentryAppInstallationTokenDeleted(analytics.Event):
    user_id: int
    organization_id: int
    sentry_app_installation_id: int
    sentry_app: str


analytics.register(SentryAppInstallationTokenDeleted)
