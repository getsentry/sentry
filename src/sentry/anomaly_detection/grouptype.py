from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import override
from uuid import UUID, uuid5

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.workflow_engine.handlers.detector.base import (
    BaseDetectorHandler,
    DetectorEvaluations,
    DetectorGroupValues,
    DetectorOccurrence,
    EventData,
    EvidenceData,
)
from sentry.workflow_engine.handlers.detector_outcome.issue_platform import (
    IssuePlatformOutcomeHandler,
)
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import (
    DetectorAPIOperation,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
    DetectorType,
)

_TRANSITION_NAMESPACE = UUID("d2bbf594-a021-4253-bcef-3c66bbf5a881")


@dataclass(frozen=True)
class AnomalyTransition:
    group_key: str
    project_id: int
    timestamp: datetime
    priority: DetectorPriorityLevel
    is_resolved: bool
    title: str
    # Internal correlation evidence may describe other projects. Never publish it.
    evidence: Mapping[str, object] = field(repr=False)
    env: str = ""

    @property
    def timestamp_utc(self) -> datetime:
        if self.timestamp.tzinfo is None:
            return self.timestamp.replace(tzinfo=UTC)
        return self.timestamp.astimezone(UTC)


class AnomalyDetection(GroupType):
    type_id = 14001
    slug = DetectorType.ANOMALY_DETECTION.value
    description = "Detected Anomaly"
    category = GroupCategory.METRIC.value
    released = False
    enable_auto_resolve = False
    enable_escalation_detection = False


class AnomalyDetectionDetectorHandler(BaseDetectorHandler[AnomalyTransition, bool]):
    @override
    def extract_value(
        self, data_packet: DataPacket[AnomalyTransition]
    ) -> DetectorGroupValues[bool]:
        transition = data_packet.packet
        if transition.project_id != self.detector.project_id:
            raise ValueError("Anomaly transition project must match its detector project")
        return DetectorGroupValues({transition.group_key: transition.is_resolved})

    @override
    def evaluate(
        self,
        data_packet: DataPacket[AnomalyTransition],
        values: Mapping[DetectorGroupKey, bool],
    ) -> DetectorEvaluations:
        transition = data_packet.packet
        evaluations = {}
        for group_key, is_resolved in values.items():
            if is_resolved:
                status_change = StatusChangeMessage(
                    fingerprint=self.get_issue_fingerprint(group_key),
                    project_id=transition.project_id,
                    new_status=GroupStatus.RESOLVED,
                    new_substatus=None,
                    detector_id=self.detector.id,
                    update_date=transition.timestamp_utc,
                    id=self._transition_id(transition),
                )
                evaluations[group_key] = DetectorEvaluation.ok(group_key).with_result(status_change)
            else:
                evaluations[group_key] = DetectorEvaluation.create_issue(
                    group_key, transition.priority
                )
        return DetectorEvaluations(evaluations=evaluations, tainted=False)

    def _transition_id(self, transition: AnomalyTransition) -> str:
        fingerprint = self.get_issue_fingerprint(transition.group_key)[0]
        phase = "resolved" if transition.is_resolved else "open"
        return uuid5(
            _TRANSITION_NAMESPACE,
            f"{transition.project_id}:{fingerprint}:{phase}:{transition.timestamp_utc.isoformat()}",
        ).hex

    @override
    def get_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        # Bound the size and avoid copying a potentially sensitive group key into issue data.
        return [uuid5(_TRANSITION_NAMESPACE, f"{self.detector.id}:{group_key!r}").hex]

    @override
    def create_occurrence(
        self, evaluation: DetectorEvaluation, data_packet: DataPacket[AnomalyTransition]
    ) -> tuple[DetectorOccurrence, EventData]:
        transition = data_packet.packet
        event_id = self._transition_id(transition)
        return (
            DetectorOccurrence(
                issue_title=transition.title,
                subtitle="Anomaly detected",
                type=AnomalyDetection,
                level="warning",
                culprit="",
                detection_time=transition.timestamp_utc,
            ),
            {
                "event_id": event_id,
                "environment": transition.env or None,
                "platform": "other",
                "contexts": {"trace": {"trace_id": event_id, "span_id": None}},
            },
        )

    @override
    def _build_workflow_engine_evidence_data(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[AnomalyTransition],
        evaluation_value: bool,
    ) -> EvidenceData[bool]:
        # The default includes detector config and source definitions, which may span projects.
        return EvidenceData(
            detector_id=self.detector.id,
            value=evaluation_value,
            data_packet_source_id=data_packet.source_id,
            conditions=[],
        )


@detector_settings_registry.register(DetectorType.ANOMALY_DETECTION)
class AnomalyDetectionDetectorSettings(DetectorSettings):
    handler = AnomalyDetectionDetectorHandler
    api_availability = {operation: False for operation in DetectorAPIOperation}


def publish_anomaly_transition(detector: Detector, transition: AnomalyTransition) -> None:
    """Publish one outbox transition and wait for broker acknowledgement before returning."""
    handler = AnomalyDetectionDetectorHandler(detector)
    packet = DataPacket(source_id=str(detector.id), packet=transition)
    evaluation = handler._evaluate(packet)[transition.group_key]
    IssuePlatformOutcomeHandler().handle(detector, evaluation, wait_for_delivery=True)
