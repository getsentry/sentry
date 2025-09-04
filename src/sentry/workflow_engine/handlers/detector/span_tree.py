import abc
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sentry.performance_issues.performance_problem import PerformanceProblem

if TYPE_CHECKING:
    from lxml.etree import _Element

from sentry.workflow_engine.handlers.detector.base import (
    DetectorHandler,
    DetectorOccurrence,
    EventData,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.processors.data_condition_group import (
    ProcessedDataCondition,
    ProcessedDataConditionGroup,
)
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)


class SpanTreeDataPacket:
    """Data packet containing an XML span tree for evaluation."""

    def __init__(self, span_tree_xml: "_Element", event: dict[str, Any]):
        self.span_tree_xml = span_tree_xml
        self.event = event


class SpanTreeDetectorHandler(DetectorHandler[SpanTreeDataPacket, dict[str, PerformanceProblem]]):
    """
    Abstract base class for DetectorHandlers that evaluate span trees.
    This is designed to work with performance issue detection on complete span trees
    rather than individual data points.
    """

    def __init__(self, detector: Detector):
        super().__init__(detector)

    @abc.abstractmethod
    def detect_problems(
        self, span_tree_xml: "_Element", event: dict[str, Any]
    ) -> dict[str, PerformanceProblem]:
        """
        Analyze the XML span tree and detect performance problems.

        Args:
            span_tree_xml: XML representation of the span tree
            event: Full event data

        Returns:
            Dictionary mapping fingerprints to PerformanceProblem instances
        """
        pass

    # This method is currently skipped in `_detect_performance_problems`, we skip straight to `detect_problems`
    # When we plug perf problems into a workflow engine pipeline, we'll want to call this instead.
    # TODO: it probably needs more test coverage
    def evaluate(
        self, data_packet: DataPacket[SpanTreeDataPacket]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult] | None:
        """
        Evaluate the span tree data packet and return results.
        """
        if not data_packet.packet:
            return None

        problems = self.extract_value(data_packet)

        if not problems:
            return None

        # Convert performance problems to detector evaluation results
        results: dict[DetectorGroupKey, DetectorEvaluationResult] = {}
        for fingerprint, problem in problems.items():
            # Type check to ensure we have a single PerformanceProblem, not a dict
            if not isinstance(problem, PerformanceProblem):
                continue  # Skip dict results for now

            # Use the fingerprint as the group key for now
            fingerprint = fingerprint or f"perf-{problem.type.type_id}-{hash(str(problem.desc))}"

            occurrence_obj, _ = self.create_occurrence(
                ProcessedDataConditionGroup(
                    logic_result=True,
                    condition_results=[
                        ProcessedDataCondition(logic_result=True, condition=None, result=problem)
                    ],
                ),
                data_packet,
                DetectorPriorityLevel.LOW,
            )

            occurrence = occurrence_obj.to_issue_occurrence(
                occurrence_id=fingerprint,
                project_id=self.detector.project_id,
                status=DetectorPriorityLevel.LOW,
                detection_time=(problem.evidence_data or {}).get("timestamp", datetime.now()),
                additional_evidence_data={},
                fingerprint=[fingerprint],
            )

            results[fingerprint] = DetectorEvaluationResult(
                group_key=fingerprint,
                is_triggered=True,
                priority=DetectorPriorityLevel.LOW,
                result=occurrence,
            )

        return results

    # TODO: is this necessary? `evaluate` is the only place it would be used, right?
    def extract_value(
        self, data_packet: DataPacket[SpanTreeDataPacket]
    ) -> dict[str, PerformanceProblem] | dict[DetectorGroupKey, dict[str, PerformanceProblem]]:
        """
        Extract the performance problems from the data packet.
        """
        if not data_packet.packet:
            return {}

        return self.detect_problems(data_packet.packet.span_tree_xml, data_packet.packet.event)

    def extract_dedupe_value(self, data_packet: DataPacket[SpanTreeDataPacket]) -> int:
        """
        Extract timestamp from the event for deduplication.
        """
        if not data_packet.packet or not data_packet.packet.event:
            return 0

        # Use event timestamp for deduplication
        return int(data_packet.packet.event.get("timestamp", 0))

    @abc.abstractmethod
    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[SpanTreeDataPacket],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        """
        Create a DetectorOccurrence from the evaluation result.

        This must be implemented by concrete detector handlers to convert
        PerformanceProblem instances into DetectorOccurrence format.
        """
        pass
