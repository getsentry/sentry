from __future__ import annotations

from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict

from sentry.incidents.typings.metric_detector import AlertContext, OpenPeriodContext
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)
from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType


class SerializableAlertContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    action_identifier_id: int
    threshold_type: int | None = None  # AlertRuleThresholdType or AnomalyDetectionThresholdType
    detection_type: str  # AlertRuleDetectionType value (TextChoices str)
    comparison_delta: int | None = None
    sensitivity: str | None = None
    resolve_threshold: float | None = None
    alert_threshold: float | None = None

    @classmethod
    def from_alert_context(cls, ac: AlertContext) -> Self:
        return cls(
            name=ac.name,
            action_identifier_id=ac.action_identifier_id,
            threshold_type=int(ac.threshold_type.value) if ac.threshold_type is not None else None,
            detection_type=ac.detection_type.value,
            comparison_delta=ac.comparison_delta,
            sensitivity=ac.sensitivity,
            resolve_threshold=ac.resolve_threshold,
            alert_threshold=ac.alert_threshold,
        )

    def to_alert_context(self) -> AlertContext:
        from sentry.incidents.models.alert_rule import (
            AlertRuleDetectionType,
            AlertRuleThresholdType,
        )

        detection_type = AlertRuleDetectionType(self.detection_type)

        threshold_type: AlertRuleThresholdType | AnomalyDetectionThresholdType | None = None
        if self.threshold_type is not None:
            if detection_type == AlertRuleDetectionType.DYNAMIC:
                threshold_type = AnomalyDetectionThresholdType(self.threshold_type)
            else:
                threshold_type = AlertRuleThresholdType(self.threshold_type)

        return AlertContext(
            name=self.name,
            action_identifier_id=self.action_identifier_id,
            threshold_type=threshold_type,
            detection_type=detection_type,
            comparison_delta=self.comparison_delta,
            sensitivity=self.sensitivity,
            resolve_threshold=self.resolve_threshold,
            alert_threshold=self.alert_threshold,
        )


class BaseMetricAlertNotificationData(NotificationData):
    group_id: int
    organization_id: int
    detector_id: int

    alert_context: SerializableAlertContext
    open_period_context: OpenPeriodContext

    notification_uuid: str


class MetricAlertNotificationData(BaseMetricAlertNotificationData):
    """GroupEvent / firing path. Renderer re-fetches GroupEvent from Snuba."""

    source: NotificationSource = NotificationSource.METRIC_ALERT

    event_id: str
    project_id: int


class ActivityMetricAlertNotificationData(BaseMetricAlertNotificationData):
    """Activity / SET_RESOLVED path. Renderer re-fetches Activity from Postgres."""

    source: NotificationSource = NotificationSource.ACTIVITY_METRIC_ALERT

    activity_id: int


_EXAMPLE_ALERT_CONTEXT = SerializableAlertContext(
    name="Example Alert",
    action_identifier_id=1,
    detection_type="static",
)
_EXAMPLE_OPEN_PERIOD_CONTEXT = OpenPeriodContext(
    id=1,
    date_started=datetime(2024, 1, 1, 0, 0, 0),
)


@template_registry.register(NotificationSource.METRIC_ALERT)
class MetricAlertNotificationTemplate(NotificationTemplate[MetricAlertNotificationData]):
    category = NotificationCategory.METRIC_ALERT
    hide_from_debugger = True
    example_data = MetricAlertNotificationData(
        event_id="abc123",
        project_id=1,
        group_id=1,
        organization_id=1,
        detector_id=1,
        alert_context=_EXAMPLE_ALERT_CONTEXT,
        open_period_context=_EXAMPLE_OPEN_PERIOD_CONTEXT,
        notification_uuid="test-uuid",
    )

    def render(self, data: MetricAlertNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Metric Alert", body=[])


@template_registry.register(NotificationSource.ACTIVITY_METRIC_ALERT)
class ActivityMetricAlertNotificationTemplate(
    NotificationTemplate[ActivityMetricAlertNotificationData]
):
    category = NotificationCategory.METRIC_ALERT
    hide_from_debugger = True
    example_data = ActivityMetricAlertNotificationData(
        group_id=1,
        organization_id=1,
        detector_id=1,
        alert_context=_EXAMPLE_ALERT_CONTEXT,
        open_period_context=_EXAMPLE_OPEN_PERIOD_CONTEXT,
        notification_uuid="test-uuid",
        activity_id=1,
    )

    def render(self, data: ActivityMetricAlertNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Metric Alert", body=[])
