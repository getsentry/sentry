from sentry import analytics


class IssueMarkReviewedEvent(analytics.Event):
    type = "issue.mark_reviewed"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("group_id"),
    )


analytics.register(IssueMarkReviewedEvent)
