from typing import int
import abc

from sentry import analytics


@analytics.eventclass()
class SentryAppIssueEvent(analytics.Event, abc.ABC):
    user_id: int | None = None
    group_id: int
    installation_id: int


@analytics.eventclass("sentry_app.issue.assigned")
class SentryAppIssueAssigned(SentryAppIssueEvent):
    pass


@analytics.eventclass("sentry_app.issue.created")
class SentryAppIssueCreated(SentryAppIssueEvent):
    pass


@analytics.eventclass("sentry_app.issue.ignored")
class SentryAppIssueIgnored(SentryAppIssueEvent):
    pass


@analytics.eventclass("sentry_app.issue.resolved")
class SentryAppIssueResolved(SentryAppIssueEvent):
    pass


@analytics.eventclass("sentry_app.issue.unresolved")
class SentryAppIssueUnresolved(SentryAppIssueEvent):
    pass


analytics.register(SentryAppIssueCreated)
analytics.register(SentryAppIssueAssigned)
analytics.register(SentryAppIssueIgnored)
analytics.register(SentryAppIssueResolved)
analytics.register(SentryAppIssueUnresolved)
