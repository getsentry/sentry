from sentry import analytics


@analytics.eventclass("metric_alert_with_ui_component.created")
class MetricAlertWithUiComponentCreatedEvent(analytics.Event):
    user_id: str | None = None
    alert_rule_id: str
    organization_id: str


analytics.register(MetricAlertWithUiComponentCreatedEvent)
