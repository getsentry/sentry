from sentry import analytics


@analytics.eventclass("integrations.pagerduty.notification_sent")
class PagerdutyIntegrationNotificationSent(analytics.Event):
    organization_id: str
    project_id: str
    category: str
    group_id: str
    notification_uuid: str
    alert_id: str | None = None


analytics.register(PagerdutyIntegrationNotificationSent)
