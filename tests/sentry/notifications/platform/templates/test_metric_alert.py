from __future__ import annotations

from datetime import datetime, timezone

from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.typings.metric_detector import AlertContext, OpenPeriodContext
from sentry.notifications.platform.templates.metric_alert import (
    MetricAlertNotificationData,
    MetricAlertNotificationTemplate,
    SerializableAlertContext,
    SerializableOpenPeriodContext,
)
from sentry.notifications.platform.types import NotificationRenderedTemplate, NotificationSource
from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.notifications.notification_action.test_metric_alert_registry_handlers import (
    MetricAlertHandlerBase,
)


def _make_notification_data(**overrides: object) -> MetricAlertNotificationData:
    """Build a minimal MetricAlertNotificationData with sensible defaults."""
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


class SerializableAlertContextTest(TestCase):
    def test_round_trip_alert_rule_threshold_type(self) -> None:
        original = AlertContext(
            name="My Alert",
            action_identifier_id=42,
            threshold_type=AlertRuleThresholdType.ABOVE,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=3600,
            sensitivity=None,
            resolve_threshold=5.0,
            alert_threshold=10.0,
        )
        round_tripped = SerializableAlertContext.from_alert_context(original).to_alert_context()

        assert round_tripped.threshold_type == AlertRuleThresholdType.ABOVE
        assert round_tripped.detection_type == AlertRuleDetectionType.STATIC
        assert round_tripped.comparison_delta == original.comparison_delta
        assert round_tripped.resolve_threshold == original.resolve_threshold
        assert round_tripped.alert_threshold == original.alert_threshold

    def test_round_trip_anomaly_detection_threshold_type(self) -> None:
        original = AlertContext(
            name="Anomaly Alert",
            action_identifier_id=99,
            threshold_type=AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            comparison_delta=None,
            sensitivity="medium",
            resolve_threshold=0.0,
            alert_threshold=0.0,
        )
        round_tripped = SerializableAlertContext.from_alert_context(original).to_alert_context()

        assert isinstance(round_tripped.threshold_type, AnomalyDetectionThresholdType)
        assert round_tripped.threshold_type == AnomalyDetectionThresholdType.ABOVE_AND_BELOW
        assert round_tripped.detection_type == AlertRuleDetectionType.DYNAMIC
        assert round_tripped.sensitivity == original.sensitivity

    def test_round_trip_none_threshold_type(self) -> None:
        original = AlertContext(
            name="No Threshold",
            action_identifier_id=3,
            threshold_type=None,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            sensitivity=None,
            resolve_threshold=None,
            alert_threshold=None,
        )
        round_tripped = SerializableAlertContext.from_alert_context(original).to_alert_context()

        assert round_tripped.threshold_type is None


class SerializableOpenPeriodContextTest(TestCase):
    def test_from_and_to_open_period_context_with_date_closed(self) -> None:
        date_started = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        date_closed = datetime(2024, 1, 1, 13, 0, 0, tzinfo=timezone.utc)
        original = OpenPeriodContext(
            id=100,
            date_started=date_started,
            date_closed=date_closed,
        )
        serializable = SerializableOpenPeriodContext.from_open_period_context(original)

        assert serializable.id == 100
        assert serializable.date_started == date_started
        assert serializable.date_closed == date_closed

        round_tripped = serializable.to_open_period_context()
        assert round_tripped.id == original.id
        assert round_tripped.date_started == original.date_started
        assert round_tripped.date_closed == original.date_closed

    def test_from_and_to_open_period_context_without_date_closed(self) -> None:
        date_started = datetime(2024, 6, 15, 9, 30, 0, tzinfo=timezone.utc)
        original = OpenPeriodContext(
            id=200,
            date_started=date_started,
            date_closed=None,
        )
        serializable = SerializableOpenPeriodContext.from_open_period_context(original)

        assert serializable.id == 200
        assert serializable.date_closed is None

        round_tripped = serializable.to_open_period_context()
        assert round_tripped.id == original.id
        assert round_tripped.date_closed is None


class MetricAlertNotificationDataTest(TestCase):
    def test_source(self) -> None:
        data = _make_notification_data()
        assert data.source == NotificationSource.METRIC_ALERT

    def test_pydantic_serialization_round_trip(self) -> None:
        alert_ctx = SerializableAlertContext(
            name="Round Trip Alert",
            action_identifier_id=5,
            threshold_type=int(AlertRuleThresholdType.ABOVE.value),
            detection_type="static",
            comparison_delta=1800,
            sensitivity=None,
            resolve_threshold=1.0,
            alert_threshold=10.0,
        )
        open_period_ctx = SerializableOpenPeriodContext(
            id=77,
            date_started=datetime(2024, 3, 1, 0, 0, 0, tzinfo=timezone.utc),
            date_closed=datetime(2024, 3, 1, 1, 0, 0, tzinfo=timezone.utc),
        )
        original = MetricAlertNotificationData(
            event_id="evt-999",
            project_id=10,
            group_id=20,
            organization_id=30,
            detector_id=40,
            alert_context=alert_ctx,
            open_period_context=open_period_ctx,
            notification_uuid="round-trip-uuid",
        )

        as_dict = original.dict()
        restored = MetricAlertNotificationData.validate(as_dict)

        assert restored.event_id == original.event_id
        assert restored.project_id == original.project_id
        assert restored.group_id == original.group_id
        assert restored.organization_id == original.organization_id
        assert restored.detector_id == original.detector_id
        assert restored.notification_uuid == original.notification_uuid
        assert restored.alert_context == original.alert_context
        assert restored.open_period_context == original.open_period_context
        assert restored.source == NotificationSource.METRIC_ALERT


class MetricAlertNotificationDataContextsTest(MetricAlertHandlerBase):
    def setUp(self) -> None:
        super().setUp()
        self.create_models()

    def test_alert_context_round_trips_from_workflow_engine_models(self) -> None:
        alert_context = AlertContext.from_workflow_engine_models(
            self.detector,
            self.evidence_data,
            self.group.status,
            DetectorPriorityLevel.HIGH,
        )
        serialized = SerializableAlertContext.from_alert_context(alert_context)
        restored = serialized.to_alert_context()

        assert restored.name == alert_context.name
        assert restored.action_identifier_id == alert_context.action_identifier_id
        assert restored.detection_type == alert_context.detection_type
        assert restored.threshold_type == alert_context.threshold_type
        assert restored.comparison_delta == alert_context.comparison_delta

    def test_open_period_context_round_trips_from_real_group(self) -> None:
        open_period_context = OpenPeriodContext.from_group(self.group)
        serialized = SerializableOpenPeriodContext.from_open_period_context(open_period_context)
        restored = serialized.to_open_period_context()

        assert restored.id == open_period_context.id
        assert restored.date_started == open_period_context.date_started
        assert restored.date_closed == open_period_context.date_closed


class MetricAlertNotificationTemplateTest(TestCase):
    def test_hide_from_debugger_is_true(self) -> None:
        assert MetricAlertNotificationTemplate.hide_from_debugger is True

    def test_render_returns_minimal_rendered_template(self) -> None:
        template = MetricAlertNotificationTemplate()
        data = _make_notification_data()

        result = template.render(data)

        assert isinstance(result, NotificationRenderedTemplate)
        assert result.subject == "Metric Alert"
        assert result.body == []

    def test_render_example_returns_rendered_template(self) -> None:
        template = MetricAlertNotificationTemplate()

        result = template.render_example()

        assert isinstance(result, NotificationRenderedTemplate)
        assert result.subject == "Metric Alert"
