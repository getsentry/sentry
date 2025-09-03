import abc
from typing import Any

from sentry.performance_issues.performance_problem import PerformanceProblem
from sentry.performance_issues.types import Span
from sentry.workflow_engine.handlers.detector.base import (
    DetectorHandler,
    DetectorOccurrence,
    EventData,
)
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)


class SpanTreeDataPacket:
    """Data packet containing a span tree for evaluation."""

    def __init__(self, spans: list[Span], event: dict[str, Any]):
        self.spans = spans
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
        self, spans: list[Span], event: dict[str, Any]
    ) -> dict[str, PerformanceProblem]:
        """
        Analyze the span tree and detect performance problems.

        Args:
            spans: List of spans from the event
            event: Full event data

        Returns:
            Dictionary mapping fingerprints to PerformanceProblem instances
        """
        pass

    def evaluate(
        self, data_packet: DataPacket[SpanTreeDataPacket]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult] | None:
        """
        Evaluate the span tree data packet and return results.
        """
        if not data_packet.value:
            return None

        problems = self.detect_problems(data_packet.value.spans, data_packet.value.event)

        if not problems:
            return None

        # Convert performance problems to detector evaluation results
        results = {}
        for fingerprint, problem in problems.items():
            # Use the fingerprint as the group key for now
            group_key = DetectorGroupKey(fingerprint)
            results[group_key] = DetectorEvaluationResult(
                status=DetectorPriorityLevel.HIGH if problem else DetectorPriorityLevel.OK,
                result=problem,
            )

        return results

    def extract_value(
        self, data_packet: DataPacket[SpanTreeDataPacket]
    ) -> dict[str, PerformanceProblem] | dict[DetectorGroupKey, dict[str, PerformanceProblem]]:
        """
        Extract the performance problems from the data packet.
        """
        if not data_packet.value:
            return {}

        return self.detect_problems(data_packet.value.spans, data_packet.value.event)

    def extract_dedupe_value(self, data_packet: DataPacket[SpanTreeDataPacket]) -> int:
        """
        Extract timestamp from the event for deduplication.
        """
        if not data_packet.value or not data_packet.value.event:
            return 0

        # Use event timestamp for deduplication
        return int(data_packet.value.event.get("timestamp", 0))

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
