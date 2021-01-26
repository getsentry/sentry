from sentry import analytics


class AlertCreatedEvent(analytics.Event):
    type = "alert.created"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("rule_id"),
        analytics.Attribute("rule_type"),
        analytics.Attribute("is_api_token"),
    )


analytics.register(AlertCreatedEvent)
