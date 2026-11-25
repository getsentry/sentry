"""Workflow Engine detector that starts a Seer investigation for each correlated anomaly."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import override

from sentry.anomaly_detection.contracts import AnomalyGroupKey
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision
from sentry.utils import metrics
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
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import (
    NO_API_OPERATIONS_AVAILABLE,
    DetectorGroupKey,
    DetectorInvestigation,
    DetectorPriorityLevel,
    DetectorSettings,
    DetectorType,
)

# Every open anomaly shares one triggered level, so an urgency change isn't a transition
# and each open starts exactly one investigation.
TRIGGERED = DetectorPriorityLevel.HIGH


@dataclass(frozen=True)
class MinuteDecisions:
    """One project's anomaly decisions for one evaluated minute, keyed by group.

    `open_groups`, when set, is every group the evaluator holds open for the project as of
    `minute`. The handler resolves triggered `DetectorState` groups outside it, so state the
    evaluator lost (a cold start, a replay that saw different data) can't stay open.
    """

    minute: datetime  # UTC, like the evaluator.
    decisions: Mapping[AnomalyGroupKey, AnomalyDecision]
    open_groups: frozenset[AnomalyGroupKey] | None = None


class AnomalyDetectionDetectorHandler(BaseDetectorHandler[MinuteDecisions, DetectorPriorityLevel]):
    """Turn the organization evaluator's decisions for one project into investigations.

    Detection and correlation happen across the organization before this handler runs, so
    the evaluator's decision is the priority. `DetectorState` is the authority on which
    groups are open: this handler turns decisions into transitions against it, per-group
    dedupe skips replayed minutes, and the evaluator's open set only ever closes groups.
    Each open, reopens included, starts its own Seer investigation, created by the service
    account in the detector's config.
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
        values: dict[DetectorGroupKey, DetectorPriorityLevel] = {}
        for group_key, decision in packet.decisions.items():
            if decision.project_id == self.detector.project_id:
                values[group_key] = DetectorPriorityLevel.OK if decision.is_resolved else TRIGGERED
        if packet.open_groups is not None:
            stranded = self._triggered_group_keys() - packet.open_groups - values.keys()
            if stranded:
                metrics.incr("anomaly_detection.stranded_groups_resolved", amount=len(stranded))
                values.update(dict.fromkeys(stranded, DetectorPriorityLevel.OK))
        return DetectorGroupValues(values)

    def _triggered_group_keys(self) -> set[str]:
        return {
            group_key
            for group_key in DetectorState.objects.filter(
                detector_id=self.detector.id, is_triggered=True
            ).values_list("detector_group_key", flat=True)
            if group_key is not None
        }

    @override
    def evaluate(
        self,
        data_packet: DataPacket[MinuteDecisions],
        values: Mapping[DetectorGroupKey, DetectorPriorityLevel],
    ) -> DetectorEvaluations:
        """Open or resolve each group whose state changes at a minute it hasn't processed.

        Each open carries the `DetectorInvestigation` to start; resolves only update state.
        The scheduler publishes before committing its checkpoint, so a retry can replay
        minutes; dedupe keeps a replayed open/resolve/reopen from starting another investigation.
        """
        packet = data_packet.packet
        minute = int(packet.minute.timestamp())
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
                assert group_key is not None, "extract_value always groups by anomaly group key"
                decision = packet.decisions[AnomalyGroupKey(group_key)]
                evaluations[group_key] = DetectorEvaluation.create_issue(
                    group_key, priority
                ).with_result(
                    # The platform's occurrence id for this open: replaying the minute
                    # yields the same id, so it can't start a second investigation.
                    _investigation(decision, self.get_occurrence_id(group_key, str(minute)))
                )

        self.state_manager.commit_state_updates()
        return DetectorEvaluations(evaluations=evaluations, tainted=False)

    @override
    def create_occurrence(
        self, evaluation: DetectorEvaluation, data_packet: DataPacket[MinuteDecisions]
    ) -> tuple[DetectorOccurrence, EventData]:
        raise NotImplementedError("Anomalies start investigations and never create occurrences")


def _investigation(decision: AnomalyDecision, investigation_id: str) -> DetectorInvestigation:
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
    return DetectorInvestigation(
        id=investigation_id,
        title=decision.title,
        subtitle="Anomaly detected",
        detection_time=decision.timestamp,
        environment=decision.env or None,
        evidence_display=[(name, str(value)) for name, value in display],
        evidence_data=evidence,
    )


@detector_settings_registry.register(DetectorType.ANOMALY_DETECTION)
class AnomalyDetectionDetectorSettings(DetectorSettings):
    handler = AnomalyDetectionDetectorHandler
    api_availability = NO_API_OPERATIONS_AVAILABLE
    config_schema = {
        "type": "object",
        "properties": {SERVICE_ACCOUNT_CONFIG_KEY: {"type": "integer", "minimum": 1}},
        "additionalProperties": False,
    }
