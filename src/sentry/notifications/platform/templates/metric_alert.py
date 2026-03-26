from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Self

from pydantic import BaseModel, ConfigDict

from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    OpenPeriodContext,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)
from sentry.seer.anomaly_detection.types import AnomalyDetectionThresholdType
from sentry.services import eventstore
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models.detector import Detector

if TYPE_CHECKING:
    from sentry.incidents.endpoints.serializers.alert_rule import AlertRuleSerializerResponse
    from sentry.workflow_engine.endpoints.serializers.detector_serializer import (
        DetectorSerializerResponse,
    )


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


class SerializableOpenPeriodContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: int
    date_started: datetime
    date_closed: datetime | None = None

    @classmethod
    def from_open_period_context(cls, opc: OpenPeriodContext) -> Self:
        return cls(
            id=opc.id,
            date_started=opc.date_started,
            date_closed=opc.date_closed,
        )

    def to_open_period_context(self) -> OpenPeriodContext:
        return OpenPeriodContext(
            id=self.id,
            date_started=self.date_started,
            date_closed=self.date_closed,
        )


class MetricAlertNotificationData(NotificationData):
    source: NotificationSource = NotificationSource.METRIC_ALERT

    # For re-fetching GroupEvent via eventstore (MetricIssueContext has ORM instances)
    event_id: str
    project_id: int
    group_id: int

    # For feature flag check(chartcuterie) + message builder
    organization_id: int
    # To rebuild the contexts
    detector_id: int

    # Pre-computed serializable contexts
    alert_context: SerializableAlertContext
    open_period_context: SerializableOpenPeriodContext

    notification_uuid: str

    @property
    def event(self) -> GroupEvent:
        event = eventstore.backend.get_event_by_id(
            self.project_id, self.event_id, group_id=self.group_id
        )
        if event is None:
            raise ValueError(f"Event {self.event_id} not found")
        elif not isinstance(event, GroupEvent):
            raise ValueError(f"Event {self.event_id} is not a GroupEvent")

        return event

    @property
    def organization(self) -> Organization:
        return Organization.objects.get_from_cache(id=self.organization_id)

    @property
    def group(self) -> Group:
        return Group.objects.get_from_cache(id=self.group_id)

    @property
    def detector(self) -> Detector:
        return Detector.objects.get(id=self.detector_id)

    @property
    def serialized_alert_rule(self) -> AlertRuleSerializerResponse:
        from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
            get_alert_rule_serializer,
        )

        return get_alert_rule_serializer(self.detector)

    @property
    def serialized_detector(self) -> DetectorSerializerResponse:
        from sentry.notifications.notification_action.metric_alert_registry.handlers.utils import (
            get_detector_serializer,
        )

        return get_detector_serializer(self.detector)

    @classmethod
    def get_metric_issue_context(cls, event: GroupEvent) -> MetricIssueContext:
        from sentry.notifications.notification_action.types import BaseMetricAlertHandler

        evidence_data, priority = BaseMetricAlertHandler._extract_from_group_event(event)
        return MetricIssueContext.from_group_event(event.group, evidence_data, priority)


@template_registry.register(NotificationSource.METRIC_ALERT)
class MetricAlertNotificationTemplate(NotificationTemplate[MetricAlertNotificationData]):
    category = NotificationCategory.METRIC_ALERT
    # hide_from_debugger because this template uses a custom renderer that bypasses
    # the standard NotificationRenderedTemplate rendering path so wouldn't load correctly in the debugger.
    hide_from_debugger = True
    example_data = MetricAlertNotificationData(
        event_id="abc123",
        project_id=1,
        group_id=1,
        organization_id=1,
        detector_id=1,
        alert_context=SerializableAlertContext(
            name="Example Alert",
            action_identifier_id=1,
            detection_type="static",
        ),
        open_period_context=SerializableOpenPeriodContext(
            id=1,
            date_started=datetime(2024, 1, 1, 0, 0, 0),
        ),
        notification_uuid="test-uuid",
    )

    def render(self, data: MetricAlertNotificationData) -> NotificationRenderedTemplate:
        # The actual rendering is handled by the provider-specific custom renderer
        # (e.g. SlackMetricAlertRenderer), which rebuilds MetricIssueContext from the
        # re-fetched GroupEvent and builds the full payload via SlackIncidentsMessageBuilder.
        # This method returns a minimal fallback for providers without a custom renderer.
        return NotificationRenderedTemplate(subject="Metric Alert", body=[])
