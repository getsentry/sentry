from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import OpenPeriodContext
from sentry.notifications.platform.templates.metric_alert import (
    MetricAlertNotificationData,
    MetricAlertNotificationTemplate,
)
from sentry.notifications.platform.types import NotificationRenderedTemplate, NotificationSource
from sentry.testutils.cases import TestCase
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)


def _make_notification_data(**overrides: Any) -> MetricAlertNotificationData:
    defaults: dict[str, Any] = {
        "group_id": 1,
        "organization_id": 1,
        "notification_uuid": "test-uuid",
        "action_id": 1,
        "open_period_context": OpenPeriodContext(
            id=1,
            date_started=datetime(2024, 1, 1, tzinfo=timezone.utc),
        ),
        "new_status": IncidentStatus.CRITICAL.value,
        "title": "Critical: Test Alert",
        "title_link": "https://sentry.io/alerts/1/",
        "text": "123 events in the last 5 minutes",
    }
    defaults.update(overrides)
    return MetricAlertNotificationData(**defaults)


class OpenPeriodContextTest(TestCase):
    def test_fields_with_date_closed(self) -> None:
        date_started = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        date_closed = datetime(2024, 1, 1, 13, 0, 0, tzinfo=timezone.utc)
        ctx = OpenPeriodContext(id=100, date_started=date_started, date_closed=date_closed)

        assert ctx.id == 100
        assert ctx.date_started == date_started
        assert ctx.date_closed == date_closed

    def test_fields_without_date_closed(self) -> None:
        date_started = datetime(2024, 6, 15, 9, 30, 0, tzinfo=timezone.utc)
        ctx = OpenPeriodContext(id=200, date_started=date_started)

        assert ctx.id == 200
        assert ctx.date_closed is None

    def test_pydantic_round_trip(self) -> None:
        date_started = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        original = OpenPeriodContext(id=100, date_started=date_started)
        restored = OpenPeriodContext.parse_obj(original.dict())

        assert restored.id == original.id
        assert restored.date_started == original.date_started
        assert restored.date_closed is None


class MetricAlertNotificationDataTest(TestCase):
    def test_source(self) -> None:
        data = _make_notification_data()
        assert data.source == NotificationSource.METRIC_ALERT

    def test_pydantic_serialization_round_trip(self) -> None:
        open_period_ctx = OpenPeriodContext(
            id=77,
            date_started=datetime(2024, 3, 1, 0, 0, 0, tzinfo=timezone.utc),
            date_closed=datetime(2024, 3, 1, 1, 0, 0, tzinfo=timezone.utc),
        )
        original = MetricAlertNotificationData(
            group_id=20,
            organization_id=30,
            notification_uuid="round-trip-uuid",
            action_id=5,
            open_period_context=open_period_ctx,
            new_status=IncidentStatus.CRITICAL.value,
            title="Critical: My Alert",
            title_link="https://sentry.io/alerts/99/",
            text="100 events in the last minute",
            chart_url="https://chart.example.com/1.png",
        )

        as_dict = original.dict()
        restored = MetricAlertNotificationData.validate(as_dict)

        assert restored.group_id == original.group_id
        assert restored.organization_id == original.organization_id
        assert restored.notification_uuid == original.notification_uuid
        assert restored.action_id == original.action_id
        assert restored.new_status == original.new_status
        assert restored.title == original.title
        assert restored.title_link == original.title_link
        assert restored.text == original.text
        assert restored.chart_url == original.chart_url
        assert restored.open_period_context == original.open_period_context
        assert restored.source == NotificationSource.METRIC_ALERT

    def test_chart_url_defaults_to_none(self) -> None:
        data = _make_notification_data()
        assert data.chart_url is None


class MetricAlertNotificationDataContextsTest(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.create_models()

    def test_open_period_context_round_trips_from_real_group(self) -> None:
        open_period_context = OpenPeriodContext.from_group(self.group)
        restored = OpenPeriodContext.parse_obj(open_period_context.dict())

        assert restored.id == open_period_context.id
        assert restored.date_started == open_period_context.date_started
        assert restored.date_closed == open_period_context.date_closed


class MetricAlertNotificationTemplateTest(TestCase):
    def test_render_returns_minimal_rendered_template(self) -> None:
        template = MetricAlertNotificationTemplate()
        data = _make_notification_data()

        result = template.render(data)

        assert isinstance(result, NotificationRenderedTemplate)
        assert result.subject == "Metric Alert"
        assert result.body == []
