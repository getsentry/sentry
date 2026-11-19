"""Workflow Engine detector that starts a Seer investigation for each correlated anomaly."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import override

from sentry.anomaly_detection.contracts import AnomalyGroupKey
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector.base import (
    BaseDetectorHandler,
    DetectorEvaluations,
    DetectorGroupValues,
    DetectorOccurrence,
    EventData,
)
from sentry.workflow_engine.handlers.detector.stateful import DetectorStateManager
from sentry.workflow_engine.handlers.detector_outcome import DetectorOutcome
from sentry.workflow_engine.handlers.detector_outcome.seer_investigation import (
    SERVICE_ACCOUNT_CONFIG_KEY,
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

# Every open anomaly shares one triggered level, so an urgency change isn't a transition
# and each open starts exactly one investigation.
TRIGGERED = DetectorPriorityLevel.HIGH


@dataclass(frozen=True)
class AnomalyDetection(GroupType):
    """Describes anomaly occurrences. They start investigations and never become issues."""

    type_id = 14001
    slug = DetectorType.ANOMALY_DETECTION.value
    description = "Detected Anomaly"
    category = GroupCategory.METRIC.value
    released = False
    default_priority = PriorityLevel.MEDIUM


@dataclass(frozen=True)
class MinuteDecisions:
    """One project's anomaly decisions for one evaluated minute, keyed by group.

    `resolved` closes open groups the evaluator no longer tracks (e.g. after a cold start).
    """

    minute: datetime  # Naive UTC, like the evaluator.
    decisions: Mapping[AnomalyGroupKey, AnomalyDecision]
    resolved: frozenset[AnomalyGroupKey] = frozenset()


class AnomalyDetectionDetectorHandler(BaseDetectorHandler[MinuteDecisions, DetectorPriorityLevel]):
    """Turn the organization evaluator's decisions for one project into investigations.

    Detection and correlation happen across the organization before this handler runs, so
    the evaluator's decision is the priority. This handler only turns decisions into
    transitions: `DetectorState` tracks which groups are open and per-group dedupe skips
    replayed minutes. Each open, including a reopen, starts one Seer investigation, created
    by the service account in the detector's config.
    """

    on_complete = DetectorOutcome.SEER_INVESTIGATION.dispatch

    def __init__(self, detector: Detector):
        super().__init__(detector)
        self.state_manager = DetectorStateManager(detector)

    @override
    def extract_value(
        self, data_packet: DataPacket[MinuteDecisions]
    ) -> DetectorGroupValues[DetectorPriorityLevel]:
        packet = data_packet.packet
        values: dict[DetectorGroupKey, DetectorPriorityLevel] = dict.fromkeys(
            packet.resolved, DetectorPriorityLevel.OK
        )
        for group_key, decision in packet.decisions.items():
            if decision.project_id == self.detector.project_id:
                values[group_key] = DetectorPriorityLevel.OK if decision.is_resolved else TRIGGERED
        return DetectorGroupValues(values)

    @override
    def evaluate(
        self,
        data_packet: DataPacket[MinuteDecisions],
        values: Mapping[DetectorGroupKey, DetectorPriorityLevel],
    ) -> DetectorEvaluations:
        """Open or resolve each group whose state changes at a minute it hasn't processed.

        The scheduler publishes before committing its checkpoint, so a retry can replay
        minutes; dedupe keeps a replayed open/resolve/reopen from starting another investigation.
        """
        minute = int(data_packet.packet.minute.replace(tzinfo=UTC).timestamp())
        state = self.state_manager.get_state_data(list(values))
        evaluations: dict[DetectorGroupKey, DetectorEvaluation] = {}

        for group_key, priority in values.items():
            group_state = state[group_key]
            if minute <= group_state.dedupe_value:
                continue
            self.state_manager.enqueue_dedupe_update(group_key, minute)

            is_open = priority != DetectorPriorityLevel.OK
            if is_open == group_state.is_triggered:
                continue

            self.state_manager.enqueue_state_update(group_key, is_open, priority)
            if is_open:
                evaluations[group_key] = DetectorEvaluation.create_issue(group_key, priority)
            else:
                evaluations[group_key] = DetectorEvaluation.ok(group_key).with_result(
                    StatusChangeMessage(
                        fingerprint=self.get_issue_fingerprint(group_key),
                        project_id=self.detector.project_id,
                        new_status=GroupStatus.RESOLVED,
                        new_substatus=None,
                        detector_id=self.detector.id,
                    )
                )

        self.state_manager.commit_state_updates()
        return DetectorEvaluations(evaluations=evaluations, tainted=False)

    @override
    def create_occurrence(
        self, evaluation: DetectorEvaluation, data_packet: DataPacket[MinuteDecisions]
    ) -> tuple[DetectorOccurrence, EventData]:
        group_key = evaluation.data["group_key"]
        assert group_key is not None, "extract_value always groups by anomaly group key"
        decision = data_packet.packet.decisions[AnomalyGroupKey(group_key)]
        evidence = decision.evidence
        display: list[tuple[str, object]] = [
            ("Signal", evidence["signal"]),
            ("Change", evidence["change_type"]),
            ("Urgency", decision.urgency),
            ("Started", evidence["started_at"]),
        ]
        if "actual" in evidence:
            display.append(("Observed", evidence["actual"]))
        if "expected" in evidence:
            display.append(("Expected", evidence["expected"]))
        evidence_display = [
            IssueEvidence(name=name, value=str(value), important=index == 0)
            for index, (name, value) in enumerate(display)
        ]
        return (
            DetectorOccurrence(
                issue_title=decision.title,
                subtitle="Anomaly detected",
                evidence_data=evidence,
                evidence_display=evidence_display,
                type=AnomalyDetection,
                level="warning",
                culprit="",
                priority=evaluation.priority,
                detection_time=decision.timestamp.replace(tzinfo=UTC),
            ),
            {"environment": decision.env or None, "platform": "other"},
        )


@detector_settings_registry.register(DetectorType.ANOMALY_DETECTION)
class AnomalyDetectionDetectorSettings(DetectorSettings):
    handler = AnomalyDetectionDetectorHandler
    api_availability = {operation: False for operation in DetectorAPIOperation}
    config_schema = {
        "type": "object",
        "properties": {SERVICE_ACCOUNT_CONFIG_KEY: {"type": "integer", "minimum": 1}},
        "additionalProperties": False,
    }
