from sentry import analytics


class SentryAppIssueResolved(analytics.Event):
    type = "sentry_app.issue.resolved"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("group_id", type=int),
        analytics.Attribute("installation_id", type=int),
    )


analytics.register(SentryAppIssueResolved)
