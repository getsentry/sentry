from sentry import analytics


class EmailNotificationSent(analytics.Event):  # type: ignore
    type = "integrations.email.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("category"),
        analytics.Attribute("actor_id"),
    )


analytics.register(EmailNotificationSent)
