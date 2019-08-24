from __future__ import absolute_import

from sentry import analytics


class SentryAppUninstalledEvent(analytics.Event):
    type = "sentry_app.uninstalled"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("sentry_app"),
    )


analytics.register(SentryAppUninstalledEvent)
