from __future__ import absolute_import

from sentry import analytics


class IssueDeletedEvent(analytics.Event):
    type = "issue.deleted"

    attributes = (
        analytics.Attribute("group_id"),
        analytics.Attribute("delete_type"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
    )


analytics.register(IssueDeletedEvent)
