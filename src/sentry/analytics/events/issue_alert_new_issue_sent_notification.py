from sentry import analytics


class IssueAlertNewIssueSentNotificationEvent(analytics.Event):
    type = "issue_alert.new_issue.sent_notification"

    attributes = (
        analytics.Attribute("issue_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("rule_id"),
    )


analytics.register(IssueAlertNewIssueSentNotificationEvent)
