from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import OpenPeriodContext
from sentry.integrations.discord.message_builder import INCIDENT_COLOR_MAPPING, LEVEL_TO_COLOR
from sentry.notifications.platform.discord.provider import (
    DiscordNotificationProvider,
)
from sentry.notifications.platform.discord.renderers.metric_alert import (
    DiscordMetricAlertRenderer,
)
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


class DiscordMetricAlertRendererInvalidDataTest(TestCase):
    def test_render_raises_on_invalid_data_type(self) -> None:
        invalid_data = SeerAutofixError(error_message="not a metric alert")
        rendered_template = NotificationRenderedTemplate(subject="Metric Alert", body=[])

        with pytest.raises(ValueError, match="does not support"):
            DiscordMetricAlertRenderer.render(
                data=invalid_data,
                rendered_template=rendered_template,
            )


class DiscordMetricAlertProviderDispatchTest(TestCase):
    def test_provider_returns_metric_alert_renderer(self) -> None:
        data = _make_notification_data()
        renderer = DiscordNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.METRIC_ALERT,
        )
        assert renderer is DiscordMetricAlertRenderer

    def test_provider_returns_default_for_unknown_category(self) -> None:
        data = _make_notification_data()
        renderer = DiscordNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.DEBUG,
        )
        assert renderer is DiscordNotificationProvider.default_renderer


class DiscordMetricAlertRendererTest(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.create_models()

        open_period_context = OpenPeriodContext.from_group(self.group)

        self.notification_data = _make_notification_data(
            group_id=self.group.id,
            organization_id=self.organization.id,
            open_period_context=open_period_context,
            title=f"Critical: {self.detector.name}",
            title_link="https://sentry.io/alerts/1/",
            text="123.45 events in the last minute",
        )
        self.rendered_template = NotificationRenderedTemplate(subject="Metric Alert", body=[])

    def test_render_produces_embed(self) -> None:
        result = DiscordMetricAlertRenderer.render(
            data=self.notification_data,
            rendered_template=self.rendered_template,
        )

        assert "embeds" in result
        embeds = result["embeds"]
        assert len(embeds) == 1

        embed = embeds[0]
        assert embed["title"] == f"Critical: {self.detector.name}"
        assert embed["url"] == "https://sentry.io/alerts/1/"
        assert "123.45 events in the last minute" in embed["description"]
        assert "Started <t:" in embed["description"]
        # Critical maps to "fatal" color
        assert embed["color"] == LEVEL_TO_COLOR[INCIDENT_COLOR_MAPPING["Critical"]]

    def test_render_includes_image_when_chart_url_set(self) -> None:
        data_with_chart = _make_notification_data(
            group_id=self.group.id,
            organization_id=self.organization.id,
            open_period_context=OpenPeriodContext.from_group(self.group),
            title=f"Critical: {self.detector.name}",
            title_link="https://sentry.io/alerts/1/",
            text="123.45 events in the last minute",
            chart_url=MOCK_CHART_URL,
        )

        result = DiscordMetricAlertRenderer.render(
            data=data_with_chart,
            rendered_template=self.rendered_template,
        )

        embed = result["embeds"][0]
        assert embed["title"] == f"Critical: {self.detector.name}"
        assert embed["url"] == "https://sentry.io/alerts/1/"
        assert "123.45 events in the last minute" in embed["description"]
        assert embed["image"]["url"] == MOCK_CHART_URL

    def test_render_without_chart_url(self) -> None:
        result = DiscordMetricAlertRenderer.render(
            data=self.notification_data,
            rendered_template=self.rendered_template,
        )

        embed = result["embeds"][0]
        assert embed["title"] == f"Critical: {self.detector.name}"
        assert embed["url"] == "https://sentry.io/alerts/1/"
        assert "123.45 events in the last minute" in embed["description"]
        assert "image" not in embed or embed.get("image") is None

    def test_render_resolved_status(self) -> None:
        resolved_data = _make_notification_data(
            group_id=self.group.id,
            organization_id=self.organization.id,
            open_period_context=OpenPeriodContext.from_group(self.group),
            title=f"Resolved: {self.detector.name}",
            title_link="https://sentry.io/alerts/1/",
            text="",
            new_status=IncidentStatus.CLOSED.value,
        )

        result = DiscordMetricAlertRenderer.render(
            data=resolved_data,
            rendered_template=self.rendered_template,
        )

        embed = result["embeds"][0]
        assert embed["title"] == f"Resolved: {self.detector.name}"
        assert embed["url"] == "https://sentry.io/alerts/1/"
        assert "Started <t:" in embed["description"]
        assert embed["color"] == LEVEL_TO_COLOR[INCIDENT_COLOR_MAPPING["Resolved"]]
