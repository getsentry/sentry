from __future__ import absolute_import

from sentry import analytics


class IssueIgnoredEvent(analytics.Event):
    type = "issue.ignored"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("default_user_id", type=int),
        analytics.Attribute("organization_id", type=int),
        analytics.Attribute("group_id"),
        analytics.Attribute("ignore_duration", type=int, required=False),
        analytics.Attribute("ignore_count", type=int, required=False),
        analytics.Attribute("ignore_window", type=int, required=False),
        analytics.Attribute("ignore_user_count", type=int, required=False),
        analytics.Attribute("ignore_user_window", type=int, required=False),
    )


analytics.register(IssueIgnoredEvent)
