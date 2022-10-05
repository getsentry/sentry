from sentry import analytics


class MSTeamsIntegrationNotificationSent(analytics.Event):
    type = "integrations.msteams.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id", required=False),
        analytics.Attribute("category"),
        analytics.Attribute("actor_id"),
        analytics.Attribute("user_id", required=False),
    )


analytics.register(MSTeamsIntegrationNotificationSent)
