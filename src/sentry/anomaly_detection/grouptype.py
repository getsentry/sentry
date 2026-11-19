from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from functools import partial
from typing import override
from uuid import UUID, uuid5

from sentry.anomaly_detection import quality
from sentry.anomaly_detection.baseline import MINUTE
from sentry.anomaly_detection.changepoint import ChangePointDetector
from sentry.anomaly_detection.contracts import ChangeEvent, SeriesKey
from sentry.anomaly_detection.detect import SeriesHistory
from sentry.anomaly_detection.series import Series, SeriesRow, build
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
from sentry.workflow_engine.processors.detector import process_detectors
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
class MinuteMeasurements:
    minute: datetime
    rows: Sequence[SeriesRow]


@dataclass
class MeasurementEvaluation:
    changes: list[tuple[str, ChangeEvent]]
    observed: set[SeriesKey]


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
    """Evaluate project measurements and deliver the resulting correlated issue outcomes."""

    # An outbox retry must distinguish a broker failure from a successful dispatch.
    on_complete = staticmethod(
        partial(IssuePlatformOutcomeHandler().handle, wait_for_delivery=True)
    )

    def _check_project(self, rows: Sequence[SeriesRow]) -> str:
        project_id = self.detector.project_id
        if project_id is None:
            raise ValueError("Anomaly detectors must be linked to a project")
        project = str(project_id)
        if any(row[3] != project for row in rows):
            raise ValueError("Anomaly measurement project must match its detector project")
        return project

    def load_baseline(self, rows: Sequence[SeriesRow]) -> dict[SeriesKey, Series]:
        self._check_project(rows)
        return build(rows)

    def evaluate_measurements(
        self,
        packet: DataPacket[MinuteMeasurements],
        history: SeriesHistory,
        change_points: ChangePointDetector,
    ) -> MeasurementEvaluation:
        """Advance local evidence; the caller correlates changes before publishing."""
        minute, rows = packet.packet.minute, packet.packet.rows
        project = self._check_project(rows)
        if minute.tzinfo is not None or minute.second or minute.microsecond:
            raise ValueError("Anomaly measurement minute must be a naive UTC minute")
        if any(row[0] != minute for row in rows):
            raise ValueError("Anomaly measurement timestamps must match the packet minute")

        measurements = build(rows)
        discovered_series = bool(measurements.keys() - history.series.keys())
        for key, values in measurements.items():
            history.series.setdefault(key, {}).update(values)
        if discovered_series:
            history.refresh(project=project)
            change_points.refresh(project=project)

        if minute.minute == 0:
            self._check_quality(history, minute, project)
            history.prune_pseudo(minute, project=project)

        observed = {key for key in measurements if history.has_novelty_observation(key, minute)}
        changes = []
        for key, rule in history.watched.items():
            if key.project == project and (action := history._step_series(key, rule, minute)):
                changes.append(action)
        for key in change_points.watched:
            if key.project == project and (state := history.state.get(key)) and state.open:
                change_points.note_spike(state.open, minute)
        changes.extend(change_points.step(minute, project=project))
        return MeasurementEvaluation(changes=changes, observed=observed)

    @staticmethod
    def _check_quality(history: SeriesHistory, minute: datetime, project: str) -> None:
        # Use only observed history and don't abandon recovery of an open excursion.
        recent_minutes = [minute - offset * MINUTE for offset in range(60)]
        measurements = {
            key: {
                observed_minute: values[observed_minute]
                for observed_minute in recent_minutes
                if observed_minute in values
            }
            for key, values in history.series.items()
            if key.project == project
            and (key.metric.startswith("p95") or key.metric == "count_sample()")
        }
        restored_series = False
        for key, invalid_reason in quality.check(measurements).items():
            if invalid_reason is not None:
                history.exclude[key] = invalid_reason
            elif history.exclude.pop(key, None) is not None:
                restored_series = True
        for key in history.exclude.keys() & history.watched.keys():
            if key.project == project and history.state[key].open is None:
                del history.watched[key]
                del history.state[key]
        if restored_series:
            history.refresh(project=project)

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
    config_schema = {"type": "object", "properties": {}, "additionalProperties": False}


def publish_anomaly_transition(detector: Detector, transition: AnomalyTransition) -> None:
    """Publish one outbox transition and wait for broker acknowledgement before returning."""
    packet = DataPacket(source_id=str(detector.id), packet=transition)
    results = process_detectors(packet, [detector])
    if not results or transition.group_key not in results[0][1]:
        raise RuntimeError("Workflow Engine did not produce an anomaly outcome")
