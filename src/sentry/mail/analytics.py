from sentry import analytics


# TODO: should have same base class as SlackIntegrationNotificationSent
class EmailNotificationSent(analytics.Event):
    type = "integrations.email.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id", required=False),
        analytics.Attribute("category"),
        analytics.Attribute("actor_id"),
    )


analytics.register(EmailNotificationSent)
