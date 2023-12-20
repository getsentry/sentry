from sentry import analytics


class AlertSentEvent(analytics.Event):
    type = "alert.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        # The id of the Alert or AlertRule
        analytics.Attribute("alert_id"),
        # "issue_alert" or "metric_alert"
        analytics.Attribute("alert_type"),
        # Slack, msteams, email, etc.
        analytics.Attribute("provider"),
        # User_id if sent via email, channel id if sent via slack, etc.
        analytics.Attribute("external_id", type=str, required=False),
        analytics.Attribute("notification_uuid", required=False),
    )


analytics.register(AlertSentEvent)
