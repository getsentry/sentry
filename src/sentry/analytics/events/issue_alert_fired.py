from sentry import analytics


class IssueAlertFiredEvent(analytics.Event):
    type = "issue_alert.fired"

    attributes = (
        analytics.Attribute("issue_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("rule_id"),
    )


analytics.register(IssueAlertFiredEvent)
