from sentry import analytics


@analytics.eventclass("issue_alert.fired")
class IssueAlertFiredEvent(analytics.Event):
    issue_id: str
    project_id: str
    organization_id: str
    rule_id: str


analytics.register(IssueAlertFiredEvent)
