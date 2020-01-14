from __future__ import absolute_import

from sentry import analytics


class IssueCreatedEvent(analytics.Event):
    type = "issue.created"

    attributes = (
        analytics.Attribute("group_id", type=int),
        analytics.Attribute("project_id", type=int),
        analytics.Attribute("organization_id", type=int),
        analytics.Attribute("event_type"),
    )


analytics.register(IssueCreatedEvent)
