import dataclasses
import logging

from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector.base import (
    BaseDetectorHandler,
    DataPacketEvaluationType,
    DataPacketType,
    GroupedDetectorEvaluationResult,
)
from sentry.workflow_engine.models import DataConditionGroup, DataPacket, Detector
from sentry.workflow_engine.processors import DataConditionGroupEvaluation, DetectorEvaluation
from sentry.workflow_engine.processors.data_condition_group import process_data_condition_group
from sentry.workflow_engine.processors.evaluations import DetectorEvaluationData
from sentry.workflow_engine.types import (
    DetectorGroupKey,
    DetectorPriorityLevel,
)

logger = logging.getLogger(__name__)


class DetectorHandler(BaseDetectorHandler[DataPacketType, DataPacketEvaluationType]):
    """
    Base implementation class for detectors that rely on data condition groups to make decisions

    Includes metrics tracking and condition group loading around the `_evaluate` template method

    Also includes a default `evaluate` implementation that subclasses can rely on or override.
    """

    def __init__(self, detector: Detector):
        super().__init__(detector)

        if detector.workflow_condition_group_id is not None:
            try:
                # Check if workflow_condition_group is already prefetched
                if Detector.workflow_condition_group.is_cached(detector):
                    group = detector.workflow_condition_group
                else:
                    group = DataConditionGroup.objects.get_from_cache(
                        id=detector.workflow_condition_group_id
                    )

                self.condition_group: DataConditionGroup | None = group
            except DataConditionGroup.DoesNotExist:
                logger.exception(
                    "Failed to find the data condition group for detector",
                    extra={"detector_id": detector.id},
                )

                self.condition_group = None
        else:
            self.condition_group = None

    def _evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluation]:
        tags = {
            "detector_type": self.detector.type,
            "result": "unknown",
        }

        try:
            value = self.evaluate(data_packet)

            tags["result"] = "tainted" if value.tainted else "success"

            metrics.incr("workflow_engine_detector.evaluation", tags=tags, sample_rate=1.0)

            return value.result
        except Exception:
            tags["result"] = "failure"

            metrics.incr("workflow_engine_detector.evaluation", tags=tags, sample_rate=1.0)

            raise

    def evaluate(self, data_packet: DataPacket[DataPacketType]) -> GroupedDetectorEvaluationResult:
        """
        A default, stateless evaluation using data condition groups

        Extracts the values from the packet, then evaluates the condition group for each group key,
        creating an occurrence for every group whose conditions trigger

        Detectors that do not group are evaluated as a single group, keyed by `None`

        Override the following methods to modify this default evaluation:
        - evaluate_conditions
        - get_issue_fingerprint
        - get_event_id
        - get_occurrence_id

        Override "evaluate" itself to have a custom evaluation flow
        """
        grouped_values = self._extract_value(data_packet)

        results: dict[DetectorGroupKey, DetectorEvaluation] = {}

        tainted = False

        for group_key, evaluation_value in grouped_values.items():
            trigger_evaluation, priority = self.evaluate_conditions(evaluation_value)

            if trigger_evaluation is None:
                continue

            tainted = tainted or trigger_evaluation.is_tainted()

            if priority == DetectorPriorityLevel.OK:
                # TODO: The existing implementation of this method does not resolve any issues created by the detector when
                # the priority goes back to OK. This was an intentional decision as it ensures issues do not get resolved erroneously.
                # In the future, we should consider either resolving the issue or allow subclasses to dictate keeping the issue open
                # versus sending a resolve status change message.
                continue

            results[group_key] = self._build_detector_evaluation(
                group_key, priority, trigger_evaluation, data_packet, evaluation_value
            )

        return GroupedDetectorEvaluationResult(result=results, tainted=tainted)

    def evaluate_conditions(
        self, value: DataPacketEvaluationType
    ) -> tuple[DataConditionGroupEvaluation | None, DetectorPriorityLevel]:
        """
        Evaluate the detector's trigger condition group against the extracted value.

        Returns the group evaluation and the highest `DetectorPriorityLevel` among the
        conditions that triggered, or `DetectorPriorityLevel.OK` when nothing triggered.
        """
        if self.condition_group is None:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")

            return None, DetectorPriorityLevel.OK

        group_evaluation, remaining_slow_conditions = process_data_condition_group(
            self.condition_group, value
        )

        if remaining_slow_conditions:
            logger.warning(
                "Slow conditions present for detector",
                extra={
                    "detector_id": self.detector.id,
                    "condition_group_id": self.condition_group.id,
                },
            )

        if not group_evaluation.triggered:
            return group_evaluation, DetectorPriorityLevel.OK

        triggered_priorities: list[DetectorPriorityLevel] = [
            condition_evaluation.result
            for condition_evaluation in group_evaluation.data["condition_evaluations"]
            if condition_evaluation.triggered
            and isinstance(condition_evaluation.result, DetectorPriorityLevel)
        ]

        if not triggered_priorities:
            return group_evaluation, DetectorPriorityLevel.OK

        return group_evaluation, max(triggered_priorities)

    def _build_detector_evaluation(
        self,
        group_key: DetectorGroupKey,
        priority: DetectorPriorityLevel,
        trigger_evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
    ) -> DetectorEvaluation:
        detector_occurrence, event_data = self.create_occurrence(
            trigger_evaluation, data_packet, priority
        )

        event_id = self.get_event_id(event_data)

        occurrence_id = self.get_occurrence_id(group_key, event_id)

        issue_fingerprint = self.get_issue_fingerprint(group_key)

        additional_evidence_data = self._build_workflow_engine_evidence_data(
            trigger_evaluation, data_packet, evaluation_value
        )

        issue_occurrence = detector_occurrence.to_issue_occurrence(
            occurrence_id=occurrence_id,
            event_id=event_id,
            project_id=self.detector.project_id,
            status=priority,
            additional_evidence_data=dataclasses.asdict(additional_evidence_data),
            fingerprint=issue_fingerprint,
        )

        event_data = self._build_event_data(event_data, issue_occurrence)

        return DetectorEvaluation(
            result=issue_occurrence,
            data=DetectorEvaluationData(
                group_key=group_key,
                trigger_group_evaluation=trigger_evaluation,
                event_data=event_data,
            ),
            triggered=True,
            priority=priority,
        )
