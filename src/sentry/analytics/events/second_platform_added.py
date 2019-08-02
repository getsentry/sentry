from __future__ import absolute_import

from sentry import analytics


class SecondPlatformAddedEvent(analytics.Event):
    type = "second_platform.added"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
    )


analytics.register(SecondPlatformAddedEvent)
