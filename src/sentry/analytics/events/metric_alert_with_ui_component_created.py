from sentry import analytics


class MetricAlertWithUiComponentCreatedEvent(analytics.Event):
    type = "metric_alert_with_ui_component.created"

    attributes = (
        analytics.Attribute("user_id", type=str, required=True),
        analytics.Attribute("alert_rule_id", type=str, required=True),
        analytics.Attribute("organization_id", type=str, required=True),
    )


analytics.register(MetricAlertWithUiComponentCreatedEvent)
