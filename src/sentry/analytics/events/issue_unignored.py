from __future__ import absolute_import

from sentry import analytics


class IssueUnignoredEvent(analytics.Event):
    type = "issue.unignored"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("default_user_id", type=int),
        analytics.Attribute("organization_id", type=int),
        analytics.Attribute("group_id"),
        analytics.Attribute("transition_type"),
    )


analytics.register(IssueUnignoredEvent)
