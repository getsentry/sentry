from sentry import analytics


class AlertEditedEvent(analytics.Event):
    type = "alert.edited"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("rule_id"),
        analytics.Attribute("rule_type"),
        analytics.Attribute("is_api_token"),
    )


analytics.register(AlertEditedEvent)
