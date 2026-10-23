import logging
from collections.abc import Mapping

from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector.base import (
    BaseDetectorHandler,
    DataPacketEvaluationType,
    DataPacketType,
    DetectorEvaluations,
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

    This is the recommended handler: customize detection by registering conditions on the detector's
    trigger condition group, rather than overriding `evaluate`.
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

    def evaluate(
        self,
        data_packet: DataPacket[DataPacketType],
        values: Mapping[DetectorGroupKey, DataPacketEvaluationType],
    ) -> DetectorEvaluations:
        """
        A default, stateless evaluation using data condition groups

        Evaluates the condition group for each group key. Every group whose conditions match gets an
        evaluation at the highest triggered priority, and is `triggered` when that priority is not OK.

        OK evaluations carry no result, so the platform drops them and open issues are left as-is.
        Subclasses can call `super().evaluate()` and act on them instead; for example,
        `StatefulDetectorHandler` resolves the issue once enough OK evaluations are seen.

        Detectors that do not group are evaluated as a single group, keyed by `None`

        Override `evaluate_conditions` to modify how a value is evaluated.
        """
        results: dict[DetectorGroupKey, DetectorEvaluation] = {}
        tainted = False

        for group_key, evaluation_value in values.items():
            trigger_evaluation, priority = self.evaluate_conditions(evaluation_value)

            if trigger_evaluation is None:
                continue

            tainted = tainted or trigger_evaluation.is_tainted()

            if not trigger_evaluation.triggered:
                continue

            results[group_key] = DetectorEvaluation(
                result=None,
                data=DetectorEvaluationData(
                    group_key=group_key,
                    trigger_group_evaluation=trigger_evaluation,
                    event_data=None,
                ),
                triggered=priority != DetectorPriorityLevel.OK,
                priority=priority,
            )

        return DetectorEvaluations(result=results, tainted=tainted)

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
