from sentry import analytics


class SlackIntegrationAssign(analytics.Event):
    type = "integrations.slack.assign"

    attributes = (analytics.Attribute("actor_id", required=False),)


class SlackIntegrationStatus(analytics.Event):
    type = "integrations.slack.status"

    attributes = (
        analytics.Attribute("status"),
        analytics.Attribute("resolve_type", required=False),
        analytics.Attribute("actor_id", required=False),
    )


class SlackIntegrationNotificationSent(analytics.Event):
    type = "integrations.slack.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("category"),
        analytics.Attribute("actor_id"),
    )


analytics.register(SlackIntegrationAssign)
analytics.register(SlackIntegrationNotificationSent)
analytics.register(SlackIntegrationStatus)
