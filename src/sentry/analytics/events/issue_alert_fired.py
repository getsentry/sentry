from typing import int
from sentry import analytics


@analytics.eventclass("issue_alert.fired")
class IssueAlertFiredEvent(analytics.Event):
    issue_id: int
    project_id: int
    organization_id: int
    rule_id: int


analytics.register(IssueAlertFiredEvent)
