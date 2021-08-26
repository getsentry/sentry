from sentry import analytics


class NotificationSent(analytics.Event):
    type = "notifications.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("type"),
    )


analytics.register(NotificationSent)
