from sentry import analytics


class SentryAppIssueAssigned(analytics.Event):
    type = "sentry_app.issue.assigned"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("group_id", type=int),
        analytics.Attribute("installation_id", type=int),
    )


analytics.register(SentryAppIssueAssigned)
