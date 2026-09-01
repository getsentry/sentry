import abc
import dataclasses
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, TypeVar, cast
from uuid import uuid4

from django.utils import timezone

from sentry.issues.grouptype import GroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.types.actor import Actor
from sentry.utils import metrics
from sentry.workflow_engine.models import DataConditionGroup, DataPacket, Detector
from sentry.workflow_engine.processors import (
    CustomDetectorEvaluation,
    DataConditionGroupEvaluation,
    DetectorEvaluation,
)
from sentry.workflow_engine.processors.data_condition_group import process_data_condition_group
from sentry.workflow_engine.processors.evaluations import DetectorEvaluationData
from sentry.workflow_engine.types import (
    DetectorGroupKey,
    DetectorId,
    DetectorPriorityLevel,
)

logger = logging.getLogger(__name__)

DataPacketType = TypeVar("DataPacketType")
DataPacketEvaluationType = TypeVar("DataPacketEvaluationType")
DataPacketEvaluationResultType = TypeVar(
    "DataPacketEvaluationResultType", bound=DataConditionGroupEvaluation | CustomDetectorEvaluation
)

EventData = dict[str, Any]


@dataclass
class EvidenceData(Generic[DataPacketEvaluationType]):
    value: DataPacketEvaluationType
    detector_id: DetectorId
    data_packet_source_id: int
    conditions: list[dict[str, Any]]
    config: dict[str, Any] = dataclasses.field(default_factory=dict, kw_only=True)
    data_sources: list[dict[str, Any]] = dataclasses.field(default_factory=list, kw_only=True)


@dataclasses.dataclass(frozen=True, kw_only=True)
class DetectorOccurrence:
    issue_title: str
    subtitle: str
    evidence_data: Mapping[str, Any] = dataclasses.field(default_factory=dict)
    evidence_display: Sequence[IssueEvidence] = dataclasses.field(default_factory=list)
    type: type[GroupType]
    level: str
    culprit: str
    resource_id: str | None = None
    assignee: Actor | None = None
    priority: DetectorPriorityLevel | None = None
    detection_time: datetime | None = None

    def to_issue_occurrence(
        self,
        *,
        occurrence_id: str,
        project_id: int,
        status: DetectorPriorityLevel,
        additional_evidence_data: Mapping[str, Any],
        fingerprint: list[str],
    ) -> IssueOccurrence:
        return IssueOccurrence(
            id=occurrence_id,
            project_id=project_id,
            event_id=occurrence_id,
            fingerprint=fingerprint,
            issue_title=self.issue_title,
            subtitle=self.subtitle,
            resource_id=self.resource_id,
            evidence_data={**self.evidence_data, **additional_evidence_data},
            evidence_display=self.evidence_display,
            type=self.type,
            detection_time=self.detection_time or timezone.now(),
            level=self.level,
            culprit=self.culprit,
            priority=self.priority or status,
            assignee=self.assignee,
        )


@dataclass(frozen=True)
class GroupedDetectorEvaluationResult:
    result: dict[DetectorGroupKey, DetectorEvaluation]
    tainted: bool


class BaseDetectorHandler(
    abc.ABC,
    Generic[DataPacketType, DataPacketEvaluationType, DataPacketEvaluationResultType],
):
    """
    Abstract base class defining the public interface for detector handlers.

    DataPacketType is what we've embedded within the data packet.

    DataPacketEvaluationType is the type of the value to be extracted from the data packet and
    used to evaluate the conditions on the detector.

    DataPacketEvaluationResultType is the type of the evaluation that explains why the detector
    triggered.
    """

    def __init__(self, detector: Detector):
        self.detector = detector

    @abc.abstractmethod
    def _evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluation]:
        pass

    @abc.abstractmethod
    def evaluate(self, data_packet: DataPacket[DataPacketType]) -> GroupedDetectorEvaluationResult:
        """
        This method is used to evaluate the data packet's value against the conditions on the detector.
        """
        pass

    @abc.abstractmethod
    def extract_value(
        self, data_packet: DataPacket[DataPacketType]
    ) -> DataPacketEvaluationType | dict[DetectorGroupKey, DataPacketEvaluationType]:
        """
        Extracts the evaluation value from the data packet to be processed.

        This value is used to determine if the data condition group is in a triggered state.
        """
        pass

    @abc.abstractmethod
    def evaluate_extracted_value(
        self,
        extracted_value: DataPacketEvaluationType,
    ) -> tuple[DataPacketEvaluationResultType | None, DetectorPriorityLevel]:
        """
        Once the value has been extracted from the data packet, evaluate data condition groups (if present) or your own custom check
        """
        pass

    @abc.abstractmethod
    def create_occurrence(
        self,
        evaluation: DataPacketEvaluationResultType,
        data_packet: DataPacket[DataPacketType],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        """
        This method provides the value that was evaluated against, the data packet that was
        used to get the data, and the condition(s) that are failing.

        To implement this, you will need to create a new `DetectorOccurrence` object,
        to represent the issue that was detected. Additionally, you can return any
        event_data to associate with the occurrence.
        """
        pass


class DetectorHandler(
    BaseDetectorHandler[DataPacketType, DataPacketEvaluationType, DataPacketEvaluationResultType]
):
    """
    Base implementation class for detectors that make decisions without data condition groups

    The class provides a default "evaluate" flow, so a subclass only has to provide the "extract_value", "evaluate_extracted_value", and "create_occurrence" methods.
    """

    def __init__(self, detector: Detector):
        super().__init__(detector)

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
        A default, stateless evaluation

        Extracts the value from the packet, decides whether to trigger the detector or not, and creates an occurrence if it does

        Override "evaluate_extracted_value" to implement the custom evaluation logic (using data condition groups or something else)
        Override "get_issue_fingerprint" and "get_occurrence_id" to modify the defaults

        Override the "evaluate" method entirely to implement a custom evaluation flow
        """
        extracted_value = self.extract_value(data_packet)

        if self._is_detector_group_value(extracted_value):
            logger.warning(
                "The default implementation of evaluate_data_packet expects a single value, but a dictionary of values was returned. To support grouping, please override the evaluate_data_packet method"
            )

            return GroupedDetectorEvaluationResult(result={}, tainted=False)

        value = cast(DataPacketEvaluationType, extracted_value)

        evaluation, priority = self.evaluate_extracted_value(value)

        if evaluation is None:
            return GroupedDetectorEvaluationResult(result={}, tainted=False)

        if priority == DetectorPriorityLevel.OK:
            return GroupedDetectorEvaluationResult(result={}, tainted=evaluation.is_tainted())

        detector_occurrence, event_data = self.create_occurrence(evaluation, data_packet, priority)

        occurrence_id = self.get_occurrence_id(event_data)

        issue_fingerprint = self.get_issue_fingerprint()

        issue_occurrence = detector_occurrence.to_issue_occurrence(
            occurrence_id=occurrence_id,
            project_id=self.detector.project_id,
            status=priority,
            additional_evidence_data={},
            fingerprint=issue_fingerprint,
        )

        event_data = self._build_event_data(event_data, issue_occurrence)

        detector_evaluation = DetectorEvaluation(
            result=issue_occurrence,
            data=DetectorEvaluationData(
                group_key=None,
                trigger_group_evaluation=evaluation,
                event_data=event_data,
            ),
            triggered=True,
            priority=priority,
        )

        return GroupedDetectorEvaluationResult(
            result={None: detector_evaluation}, tainted=evaluation.is_tainted()
        )

    def get_occurrence_id(self, event_data: EventData) -> str:
        id_in_event_data = event_data.get("event_id")

        if id_in_event_data:
            return id_in_event_data

        return str(uuid4())

    def get_issue_fingerprint(self) -> list[str]:
        return [f"detector:{self.detector.id}"]

    def _build_event_data(
        self, event_data: EventData, issue_occurrence: IssueOccurrence
    ) -> EventData:
        event_data["event_id"] = issue_occurrence.event_id

        event_data["project_id"] = issue_occurrence.project_id

        event_data["timestamp"] = issue_occurrence.detection_time

        event_data.setdefault("environment", self.detector.config.get("environment"))

        event_data.setdefault("platform", "python")

        event_data.setdefault("received", issue_occurrence.detection_time)

        event_data.setdefault("tags", {})

        return event_data

    def _is_detector_group_value(self, value: Any) -> bool:
        """
        Check if value is dict[DetectorGroupKey, DataPacketEvaluationType]
        """
        if not isinstance(value, dict):
            return False

        if not value:  # Empty dict case
            return False

        # Check if all keys are DetectorGroupKey instances
        return all(isinstance(key, DetectorGroupKey) for key in value.keys())


class ConditionDetectorHandler(
    DetectorHandler[DataPacketType, DataPacketEvaluationType, DataConditionGroupEvaluation]
):
    """
    Base implementation class providing shared infrastructure for detector handlers.
    Includes metrics tracking and condition group loading around the `evaluate` template method.

    TODO - Implement a standard DetectorHandler with this base class -- a-la StatefulDetectorHandler
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

    def evaluate_extracted_value(
        self,
        extracted_value: DataPacketEvaluationType,
    ) -> tuple[DataConditionGroupEvaluation | None, DetectorPriorityLevel]:
        if self.condition_group is None:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")
            return None, DetectorPriorityLevel.OK

        group_evaluation, remaining_slow_conditions = process_data_condition_group(
            self.condition_group, extracted_value
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
