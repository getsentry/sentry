from __future__ import absolute_import

from sentry import analytics


class FirstReleaseTagSentEvent(analytics.Event):
    type = "first_release_tag.sent"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
    )


analytics.register(FirstReleaseTagSentEvent)
