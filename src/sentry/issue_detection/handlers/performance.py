from __future__ import annotations

from typing import Any
from uuid import uuid4

from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.workflow_engine.handlers.detector import DetectorHandler, DetectorOccurrence
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.processors.evaluations import DetectorEvaluationData
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel


class PerformanceDetectorHandler(DetectorHandler[PerformanceProblem]):
    """
    Turns a `PerformanceProblem` into the occurrence the workflow engine expects.

    Detection stays where it already is. `detect_performance_problems` runs the detectors in
    `sentry.issue_detection.detectors` and hands each problem it found to this handler, one
    per data packet -- so by the time a packet exists, the decision has already been made.
    This class holds no settings, no thresholds and no spans; the whole of it is the
    mapping, which is identical for all 14 detectors.

    It implements `DetectorHandler.evaluate` directly rather than deriving from
    `BaseDetectorHandler`. There are no data conditions to evaluate, so there is no
    `DataConditionGroup` to load and no condition-group evaluation to invent, and the
    `extract_value` / `extract_dedupe_value` / `create_occurrence` contract those bases
    impose would be a chain of stubs. Nothing is remembered between packets.
    """

    def evaluate(
        self, data_packet: DataPacket[PerformanceProblem]
    ) -> dict[DetectorGroupKey, DetectorEvaluation]:
        # One packet is one problem, so the result is ungrouped. The occurrence id is minted
        # here, at the framework hook, keeping the mapping below a pure function of its
        # arguments.
        evaluation = self._to_evaluation(data_packet, occurrence_id=uuid4().hex)

        return {None: evaluation}

    def _to_evaluation(
        self, data_packet: DataPacket[PerformanceProblem], *, occurrence_id: str
    ) -> DetectorEvaluation:
        problem = data_packet.packet

        # Nothing escalates or resolves here, so there is no priority to compute: fall back
        # to the group type's default, which is what the Issue Platform would apply. Read
        # off the problem rather than the detector, so it cannot disagree with the type of
        # the occurrence built below.
        priority = DetectorPriorityLevel(problem.type.default_priority)

        occurrence = self._to_issue_occurrence(
            data_packet, occurrence_id=occurrence_id, priority=priority
        )

        return DetectorEvaluation(
            result=occurrence,
            data=DetectorEvaluationData(
                group_key=None,
                event_data=self._build_event_data(occurrence),
            ),
            triggered=True,
            priority=priority,
        )

    def _to_issue_occurrence(
        self,
        data_packet: DataPacket[PerformanceProblem],
        *,
        occurrence_id: str,
        priority: DetectorPriorityLevel,
    ) -> IssueOccurrence:
        problem = data_packet.packet

        detector_occurrence = DetectorOccurrence(
            issue_title=problem.title,
            subtitle=problem.desc,
            evidence_data=dict(problem.evidence_data),
            evidence_display=list(problem.evidence_display),
            type=problem.type,
            level="info",
            culprit="",
        )

        return detector_occurrence.to_issue_occurrence(
            occurrence_id=occurrence_id,
            project_id=self.detector.project_id,
            status=priority,
            additional_evidence_data=self._build_detector_evidence_data(data_packet),
            # The detector's fingerprint, verbatim, so these occurrences land in the issues
            # the legacy pipeline already creates rather than opening duplicates.
            fingerprint=[problem.fingerprint],
        )

    def _build_detector_evidence_data(
        self, data_packet: DataPacket[PerformanceProblem]
    ) -> dict[str, Any]:
        # `detector_id` is what lets the workflow engine find this detector again from the
        # occurrence. Deliberately omits the `conditions` and `data_sources` keys the
        # stateful handler adds: these detectors have neither.
        return {
            "detector_id": self.detector.id,
            "data_packet_source_id": str(data_packet.source_id),
            "config": self.detector.config,
        }

    def _build_event_data(self, occurrence: IssueOccurrence) -> EventData:
        # The event is stamped from the occurrence: the Issue Platform rejects the pair if
        # their event ids disagree.
        #
        # TODO: a problem carries no event, so this is the bare minimum the platform will
        # accept -- no platform, culprit or transaction name. Fill these in from the
        # transaction once `detect_performance_problems` passes its event through.
        return {
            "environment": self.detector.config.get("environment"),
            "event_id": occurrence.event_id,
            "project_id": occurrence.project_id,
            "received": occurrence.detection_time,
            "tags": {},
            "timestamp": occurrence.detection_time,
        }
