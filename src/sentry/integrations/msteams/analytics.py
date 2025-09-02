from sentry import analytics


@analytics.eventclass("integrations.msteams.notification_sent")
class MSTeamsIntegrationNotificationSent(analytics.Event):
    organization_id: int
    project_id: int | None = None
    category: str
    actor_id: int | None = None
    user_id: int | None = None
    notification_uuid: str
    alert_id: int | None = None


analytics.register(MSTeamsIntegrationNotificationSent)
