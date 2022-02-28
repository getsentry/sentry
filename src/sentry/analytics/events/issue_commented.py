from sentry import analytics


class IssueCommentedEvent(analytics.Event):
    type = "issue.commented"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("group_id"),
    )


analytics.register(IssueCommentedEvent)
