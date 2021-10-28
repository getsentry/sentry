from sentry import analytics


class MetricAlertWithUiComponentCreatedEvent(analytics.Event):
    type = "metric_alert_with_ui_component.created"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("alert_rule_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(MetricAlertWithUiComponentCreatedEvent)
