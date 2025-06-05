from sentry import analytics


@analytics.eventclass("integrations.opsgenie.notification_sent")
class OpsgenieIntegrationNotificationSent(analytics.Event):
    organization_id: str
    project_id: str
    category: str
    group_id: str
    notification_uuid: str
    alert_id: str | None = None


analytics.register(OpsgenieIntegrationNotificationSent)
