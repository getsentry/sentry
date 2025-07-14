from sentry import analytics


@analytics.eventclass("alert.sent")
class AlertSentEvent(analytics.Event):
    organization_id: int
    project_id: int
    # The id of the Alert or AlertRule
    alert_id: str
    # "issue_alert" or "metric_alert"
    alert_type: str
    # Slack, msteams, email, etc.
    provider: str
    # User_id if sent via email, channel id if sent via slack, etc.
    external_id: str | None = None
    notification_uuid: str | None = None


analytics.register(AlertSentEvent)
