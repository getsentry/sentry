from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import OpenPeriodContext
from sentry.notifications.platform.slack.provider import SlackNotificationProvider
from sentry.notifications.platform.slack.renderers.metric_alert import SlackMetricAlertRenderer
from sentry.notifications.platform.templates.metric_alert import MetricAlertNotificationData
from sentry.notifications.platform.templates.seer import SeerAutofixError
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
)
from sentry.testutils.cases import TestCase
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

MOCK_CHART_URL = "https://chart.example.com/metric.png"


def _make_notification_data(**overrides: Any) -> MetricAlertNotificationData:
    defaults: dict[str, Any] = dict(
        group_id=1,
        organization_id=1,
        notification_uuid="test-uuid",
        action_id=1,
        open_period_context=OpenPeriodContext(
            id=1,
            date_started=datetime(2024, 1, 1, tzinfo=timezone.utc),
        ),
        new_status=IncidentStatus.CRITICAL.value,
        title="Critical: Test Alert",
        title_link="https://sentry.io/alerts/1/",
        text="123 events in the last 5 minutes",
    )
    defaults.update(overrides)
    return MetricAlertNotificationData(**defaults)


class SlackMetricAlertRendererInvalidDataTest(TestCase):
    def test_render_raises_on_invalid_data_type(self) -> None:
        invalid_data = SeerAutofixError(error_message="not a metric alert")
        rendered_template = NotificationRenderedTemplate(subject="Metric Alert", body=[])

        with pytest.raises(ValueError, match="does not support"):
            SlackMetricAlertRenderer.render(
                data=invalid_data,
                rendered_template=rendered_template,
            )


class SlackMetricAlertProviderDispatchTest(TestCase):
    def test_provider_returns_metric_alert_renderer(self) -> None:
        data = _make_notification_data()
        renderer = SlackNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.METRIC_ALERT,
        )
        assert renderer is SlackMetricAlertRenderer

    def test_provider_returns_default_for_unknown_category(self) -> None:
        data = _make_notification_data()
        renderer = SlackNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.DEBUG,
        )
        assert renderer is SlackNotificationProvider.default_renderer


class SlackMetricAlertRendererTest(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.create_models()

        open_period_context = OpenPeriodContext.from_group(self.group)

        self.notification_data = _make_notification_data(
            group_id=self.group.id,
            organization_id=self.organization.id,
            action_id=1,
            open_period_context=open_period_context,
            new_status=IncidentStatus.CRITICAL.value,
            title=f"Critical: {self.detector.name}",
            title_link="https://sentry.io/alerts/1/",
            text="123.45 events in the last minute",
        )
        self.rendered_template = NotificationRenderedTemplate(subject="Metric Alert", body=[])

    def test_render_produces_blocks(self) -> None:
        result = SlackMetricAlertRenderer.render(
            data=self.notification_data,
            rendered_template=self.rendered_template,
        )

        # Without a chart: exactly one section block with the metric text
        blocks: list[Any] = result["blocks"]
        assert len(blocks) == 1
        assert blocks[0]["type"] == "section"
        assert blocks[0]["text"]["type"] == "mrkdwn"
        assert "123.45 events in the last minute" in blocks[0]["text"]["text"]
        # Fallback text should reference the detector/alert name
        assert self.detector.name in result["text"]

    def test_render_includes_image_block_when_chart_url_present(self) -> None:
        data_with_chart = _make_notification_data(
            group_id=self.group.id,
            organization_id=self.organization.id,
            open_period_context=OpenPeriodContext.from_group(self.group),
            new_status=IncidentStatus.CRITICAL.value,
            title=f"Critical: {self.detector.name}",
            title_link="https://sentry.io/alerts/1/",
            text="123.45 events in the last minute",
            chart_url=MOCK_CHART_URL,
        )

        result = SlackMetricAlertRenderer.render(
            data=data_with_chart,
            rendered_template=self.rendered_template,
        )

        # With a chart: section block + image block
        blocks: list[Any] = result["blocks"]
        assert len(blocks) == 2
        assert blocks[0]["type"] == "section"
        assert "123.45 events in the last minute" in blocks[0]["text"]["text"]
        assert blocks[1]["type"] == "image"
        assert blocks[1]["image_url"] == MOCK_CHART_URL
        assert blocks[1]["alt_text"] == "Metric Alert Chart"

    def test_render_without_chart_url(self) -> None:
        result = SlackMetricAlertRenderer.render(
            data=self.notification_data,
            rendered_template=self.rendered_template,
        )

        blocks: list[Any] = result["blocks"]
        assert len(blocks) == 1
        assert blocks[0]["type"] == "section"

    def test_render_resolved_status(self) -> None:
        resolved_data = _make_notification_data(
            group_id=self.group.id,
            organization_id=self.organization.id,
            open_period_context=OpenPeriodContext.from_group(self.group),
            new_status=IncidentStatus.CLOSED.value,
            title=f"Resolved: {self.detector.name}",
            title_link="https://sentry.io/alerts/1/",
            text="",
        )

        result = SlackMetricAlertRenderer.render(
            data=resolved_data,
            rendered_template=self.rendered_template,
        )

        assert "Resolved" in result["text"]
        assert self.detector.name in result["text"]
