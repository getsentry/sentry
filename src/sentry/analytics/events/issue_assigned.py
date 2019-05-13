from __future__ import absolute_import

from sentry import analytics


class IssueAssignedEvent(analytics.Event):
    type = "issue.assigned"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("group_id"),
    )


analytics.register(IssueAssignedEvent)
