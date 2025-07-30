from sentry import analytics


@analytics.eventclass("integrations.opsgenie.notification_sent")
class OpsgenieIntegrationNotificationSent(analytics.Event):
    organization_id: int
    project_id: int
    category: str
    group_id: str
    notification_uuid: str
    alert_id: int | None = None


analytics.register(OpsgenieIntegrationNotificationSent)
