from __future__ import annotations

from datetime import datetime

from sentry.incidents.typings.metric_detector import OpenPeriodContext
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)


class MetricAlertNotificationData(NotificationData):
    source: NotificationSource = NotificationSource.METRIC_ALERT

    # Identity / threading
    group_id: int
    organization_id: int
    notification_uuid: str
    action_id: int  # for ThreadKey key_data (used in PR 2 hookup)
    open_period_context: OpenPeriodContext  # id + date_started used in renderer and threading
    new_status: int  # IncidentStatus value; used for color mapping and reply_broadcast

    # Pre-computed from incident_attachment_info() — all serializable strings
    title: str
    title_link: str
    text: str

    # Pre-computed chart URL (None if feature disabled or build failed)
    chart_url: str | None = None


_EXAMPLE_OPEN_PERIOD_CONTEXT = OpenPeriodContext(
    id=1,
    date_started=datetime(2024, 1, 1, 0, 0, 0),
)


@template_registry.register(NotificationSource.METRIC_ALERT)
class MetricAlertNotificationTemplate(NotificationTemplate[MetricAlertNotificationData]):
    category = NotificationCategory.METRIC_ALERT
    example_data = MetricAlertNotificationData(
        group_id=1,
        organization_id=1,
        notification_uuid="test-uuid",
        action_id=1,
        open_period_context=_EXAMPLE_OPEN_PERIOD_CONTEXT,
        new_status=20,  # IncidentStatus.CRITICAL
        title="Critical: Example Alert",
        title_link="https://sentry.io/organizations/example/alerts/rules/details/1/",
        text="123 events in the last 5 minutes",
    )

    def render(self, data: MetricAlertNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Metric Alert", body=[])
