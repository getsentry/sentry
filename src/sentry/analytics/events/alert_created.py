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
        # `alert_rule_ui_component` can be `alert-rule-action`
        analytics.Attribute("alert_rule_ui_component", required=False),
        analytics.Attribute("duplicate_rule", required=False),
        analytics.Attribute("wizard_v3", required=False),
        analytics.Attribute("query_type", required=False),
    )


analytics.register(AlertCreatedEvent)
