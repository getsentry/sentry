from __future__ import absolute_import

from sentry import analytics


class IssueCreatedEvent(analytics.Event):
    type = "issue.created"

    attributes = (
        analytics.Attribute("group_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(IssueCreatedEvent)
