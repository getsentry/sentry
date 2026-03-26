from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from sentry.incidents.typings.metric_detector import AlertContext, OpenPeriodContext
from sentry.notifications.platform.slack.provider import SlackNotificationProvider
from sentry.notifications.platform.slack.renderers.metric_alert import SlackMetricAlertRenderer
from sentry.notifications.platform.templates.metric_alert import (
    MetricAlertNotificationData,
    SerializableAlertContext,
    SerializableOpenPeriodContext,
)
from sentry.notifications.platform.templates.seer import SeerAutofixError
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)

MOCK_CHART_URL = "https://chart.example.com/metric.png"


def _make_notification_data(**overrides: object) -> MetricAlertNotificationData:
    defaults: dict[str, object] = dict(
        event_id="abc123",
        project_id=1,
        group_id=1,
        organization_id=1,
        detector_id=1,
        alert_context=SerializableAlertContext(
            name="Test Alert",
            action_identifier_id=1,
            detection_type="static",
        ),
        open_period_context=SerializableOpenPeriodContext(
            id=1,
            date_started=datetime(2024, 1, 1, tzinfo=timezone.utc),
        ),
        notification_uuid="test-uuid",
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

        alert_context = AlertContext.from_workflow_engine_models(
            self.detector,
            self.evidence_data,
            self.group.status,
            DetectorPriorityLevel.HIGH,
        )
        open_period_context = OpenPeriodContext.from_group(self.group)

        self.notification_data = MetricAlertNotificationData(
            event_id=self.group_event.event_id,
            project_id=self.project.id,
            group_id=self.group.id,
            organization_id=self.organization.id,
            detector_id=self.detector.id,
            alert_context=SerializableAlertContext.from_alert_context(alert_context),
            open_period_context=SerializableOpenPeriodContext.from_open_period_context(
                open_period_context
            ),
            notification_uuid="test-uuid",
        )
        self.rendered_template = NotificationRenderedTemplate(subject="Metric Alert", body=[])

    @patch(
        "sentry.notifications.platform.slack.renderers.metric_alert.build_metric_alert_chart",
        return_value=None,
    )
    @patch(
        "sentry.notifications.platform.templates.metric_alert.eventstore.backend.get_event_by_id"
    )
    def test_render_produces_blocks(self, mock_get_event: MagicMock, mock_chart: MagicMock) -> None:
        mock_get_event.return_value = self.group_event

        result = SlackMetricAlertRenderer.render(
            data=self.notification_data,
            rendered_template=self.rendered_template,
        )

        # Without a chart: exactly one section block with the metric text
        # This is annoying but since Block is not indexable and we want to test the structure we need to say Any
        blocks: list[Any] = result["blocks"]
        assert len(blocks) == 1
        assert blocks[0]["type"] == "section"
        assert blocks[0]["text"]["type"] == "mrkdwn"
        assert "123.45 events in the last minute" in blocks[0]["text"]["text"]
        # Fallback text should reference the detector/alert name
        assert self.detector.name in result["text"]

    @patch(
        "sentry.notifications.platform.slack.renderers.metric_alert.build_metric_alert_chart",
        return_value=MOCK_CHART_URL,
    )
    @patch(
        "sentry.notifications.platform.templates.metric_alert.eventstore.backend.get_event_by_id"
    )
    @with_feature({"organizations:metric-alert-chartcuterie": True})
    def test_render_includes_image_block_when_chart_enabled(
        self, mock_get_event: MagicMock, mock_chart: MagicMock
    ) -> None:
        mock_get_event.return_value = self.group_event

        result = SlackMetricAlertRenderer.render(
            data=self.notification_data,
            rendered_template=self.rendered_template,
        )

        # With a chart: section block + image block
        # This is annoying but since Block is not indexable and we want to test the structure we need to say Any
        blocks: list[Any] = result["blocks"]
        assert len(blocks) == 2
        assert blocks[0]["type"] == "section"
        assert "123.45 events in the last minute" in blocks[0]["text"]["text"]
        assert blocks[1]["type"] == "image"
        assert blocks[1]["image_url"] == MOCK_CHART_URL
        assert blocks[1]["alt_text"] == "Metric Alert Chart"

    @patch("sentry.notifications.platform.slack.renderers.metric_alert.sentry_sdk")
    @patch(
        "sentry.notifications.platform.slack.renderers.metric_alert.build_metric_alert_chart",
        side_effect=Exception("chart service unavailable"),
    )
    @patch(
        "sentry.notifications.platform.templates.metric_alert.eventstore.backend.get_event_by_id"
    )
    def test_render_continues_when_chart_fails(
        self, mock_get_event: MagicMock, mock_chart: MagicMock, mock_sdk: MagicMock
    ) -> None:
        mock_get_event.return_value = self.group_event

        with self.feature("organizations:metric-alert-chartcuterie"):
            result = SlackMetricAlertRenderer.render(
                data=self.notification_data,
                rendered_template=self.rendered_template,
            )

        mock_sdk.capture_exception.assert_called_once()
        # Render completes without the chart — just the section block
        # This is annoying but since Block is not indexable and we want to test the structure we need to say Any
        blocks: list[Any] = result["blocks"]
        assert len(blocks) == 1
        assert blocks[0]["type"] == "section"
