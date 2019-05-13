from __future__ import absolute_import

from sentry import analytics


class IssueTrackerUsedEvent(analytics.Event):
    type = "issue_tracker.used"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("issue_tracker"),
        analytics.Attribute("project_id"),
    )


analytics.register(IssueTrackerUsedEvent)
