"""Issue Platform type and Workflow Engine detector for correlated anomalies."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import override

from sentry.anomaly_detection.contracts import AnomalyGroupKey, Urgency
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision
from sentry.issues.grouptype import GroupCategory, GroupType, NotificationConfig
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector.base import (
    DetectorEvaluations,
    DetectorGroupValues,
    DetectorOccurrence,
    EventData,
)
from sentry.workflow_engine.handlers.detector.stateful import (
    DetectorThresholds,
    StatefulDetectorHandler,
)
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import (
    DetectorAPIOperation,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
    DetectorType,
)

URGENCY_PRIORITY = {
    Urgency.LOW: DetectorPriorityLevel.LOW,
    Urgency.MEDIUM: DetectorPriorityLevel.MEDIUM,
    Urgency.HIGH: DetectorPriorityLevel.HIGH,
}


@dataclass(frozen=True)
class AnomalyDetection(GroupType):
    type_id = 14001
    slug = DetectorType.ANOMALY_DETECTION.value
    description = "Detected Anomaly"
    category = GroupCategory.METRIC.value
    released = False
    default_priority = PriorityLevel.MEDIUM
    enable_auto_resolve = False
    enable_escalation_detection = False
    creation_quota = Quota(3600, 60, 100)
    notification_config = NotificationConfig(context=[])
    in_default_search = False


@dataclass(frozen=True)
class MinuteDecisions:
    """One project's anomaly decisions for one evaluated minute, keyed by group."""

    minute: datetime  # Naive UTC, like the evaluator.
    decisions: Mapping[AnomalyGroupKey, AnomalyDecision]


class AnomalyDetectionDetectorHandler(
    StatefulDetectorHandler[MinuteDecisions, DetectorPriorityLevel]
):
    """Publish the organization evaluator's decisions for one project.

    Detection and correlation happen across the organization before this handler runs;
    the platform owns open/resolve state, replay dedupe and issue identity.
    """

    # Each activation of a group is a new issue; a reopen never regresses a closed one.
    regression_timeout = timedelta(0)

    @property
    @override
    def thresholds(self) -> DetectorThresholds:
        # The evaluator already requires persistence; transition on the first decision.
        return {level: 1 for level in URGENCY_PRIORITY.values()}

    @override
    def extract_dedupe_value(self, data_packet: DataPacket[MinuteDecisions]) -> int:
        return int(data_packet.packet.minute.replace(tzinfo=UTC).timestamp())

    @override
    def extract_value(
        self, data_packet: DataPacket[MinuteDecisions]
    ) -> DetectorGroupValues[DetectorPriorityLevel]:
        return DetectorGroupValues(
            {
                group_key: (
                    DetectorPriorityLevel.OK
                    if decision.is_resolved
                    else URGENCY_PRIORITY[decision.urgency]
                )
                for group_key, decision in data_packet.packet.decisions.items()
                if decision.project_id == self.detector.project_id
            }
        )

    @override
    def evaluate_priorities(
        self,
        data_packet: DataPacket[MinuteDecisions],
        values: Mapping[DetectorGroupKey, DetectorPriorityLevel],
    ) -> DetectorEvaluations:
        return DetectorEvaluations(
            evaluations={
                group_key: (
                    DetectorEvaluation.ok(group_key)
                    if priority == DetectorPriorityLevel.OK
                    else DetectorEvaluation.create_issue(group_key, priority)
                )
                for group_key, priority in values.items()
            },
            tainted=False,
        )

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
    config_schema = {"type": "object", "properties": {}, "additionalProperties": False}
