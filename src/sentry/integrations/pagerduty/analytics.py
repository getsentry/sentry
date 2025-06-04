from sentry import analytics


class PagerdutyIntegrationNotificationSent(analytics.Event):
    type = "integrations.pagerduty.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("category"),
        analytics.Attribute("group_id"),
        analytics.Attribute("notification_uuid"),
        analytics.Attribute("alert_id", required=False),
    )


analytics.register(PagerdutyIntegrationNotificationSent)
