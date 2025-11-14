from typing import int
from sentry import analytics


@analytics.eventclass("metric_alert_with_ui_component.created")
class MetricAlertWithUiComponentCreatedEvent(analytics.Event):
    user_id: int | None = None
    alert_rule_id: int
    organization_id: int


analytics.register(MetricAlertWithUiComponentCreatedEvent)
