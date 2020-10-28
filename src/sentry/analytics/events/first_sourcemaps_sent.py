from __future__ import absolute_import

from sentry import analytics


class FirstSourcemapsSentEvent(analytics.Event):
    type = "first_sourcemaps.sent"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
    )


analytics.register(FirstSourcemapsSentEvent)
