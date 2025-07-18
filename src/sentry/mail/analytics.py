from sentry import analytics


# TODO: should have same base class as SlackIntegrationNotificationSent
@analytics.eventclass("integrations.email.notification_sent")
class EmailNotificationSent(analytics.Event):
    organization_id: str
    project_id: str | None = None
    category: str
    actor_id: str | None = None
    user_id: str | None = None
    group_id: str | None = None
    id: str
    actor_type: str
    notification_uuid: str
    alert_id: str | None = None


analytics.register(EmailNotificationSent)
