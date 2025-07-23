from sentry import analytics


@analytics.eventclass("integrations.msteams.notification_sent")
class MSTeamsIntegrationNotificationSent(analytics.Event):
    organization_id: str
    project_id: str | None = None
    category: str
    actor_id: str | None = None
    user_id: str | None = None
    notification_uuid: str
    alert_id: str | None = None


analytics.register(MSTeamsIntegrationNotificationSent)
