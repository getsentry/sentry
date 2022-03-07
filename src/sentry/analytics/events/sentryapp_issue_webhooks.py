import abc

from sentry import analytics


class SentryAppIssueEvent(analytics.Event, abc.ABC):
    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("group_id", type=int),
        analytics.Attribute("installation_id", type=int),
    )


class SentryAppIssueAssigned(SentryAppIssueEvent):
    type = "sentry_app.issue.assigned"


class SentryAppIssueCreated(SentryAppIssueEvent):
    type = "sentry_app.issue.created"


class SentryAppIssueIgnored(SentryAppIssueEvent):
    type = "sentry_app.issue.ignored"


class SentryAppIssueResolved(SentryAppIssueEvent):
    type = "sentry_app.issue.resolved"


analytics.register(SentryAppIssueCreated)
analytics.register(SentryAppIssueAssigned)
analytics.register(SentryAppIssueIgnored)
analytics.register(SentryAppIssueResolved)
