from __future__ import absolute_import

from sentry import analytics


class InternalIntegrationCreatedEvent(analytics.Event):
    type = "internal_integration.created"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("sentry_app"),
    )


analytics.register(InternalIntegrationCreatedEvent)
