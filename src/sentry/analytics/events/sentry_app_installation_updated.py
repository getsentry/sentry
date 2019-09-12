from __future__ import absolute_import

from sentry import analytics


class SentryAppInstallationUpdatedEvent(analytics.Event):
    type = "sentry_app_installation.updated"

    attributes = (
        analytics.Attribute("sentry_app_installation_id"),
        analytics.Attribute("sentry_app_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(SentryAppInstallationUpdatedEvent)
