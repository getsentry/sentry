from sentry import analytics


# TODO: should have same base class as SlackIntegrationNotificationSent
@analytics.eventclass("integrations.email.notification_sent")
class EmailNotificationSent(analytics.Event):
    organization_id: int
    project_id: int | None = None
    category: str
    actor_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None
    id: int
    actor_type: str
    notification_uuid: str
    alert_id: int | None = None


analytics.register(EmailNotificationSent)
