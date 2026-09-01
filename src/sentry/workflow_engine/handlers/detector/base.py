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
from sentry.workflow_engine.processors import DataConditionGroupEvaluation, DetectorEvaluation
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


class BaseDetectorHandler(abc.ABC, Generic[DataPacketType, DataPacketEvaluationType]):
    """
    Abstract base class defining the public interface for detector handlers.

    DataPacketType is what we've embedded within the data packet.
    DataPacketEvaluationType is the type of the value to be extracted from the data packet and
    used to evaluate the conditions on the detector.
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
    def create_occurrence(
        self,
        evaluation: DataConditionGroupEvaluation,
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

        Override "evaluate_conditions", "get_issue_fingerprint", and "get_occurrence_id" to modify this default evaluation

        Override "evaluate" itself to have a custom evaluation flow
        """
        grouped_values = self._extract_value_from_packet(data_packet)

        results: dict[DetectorGroupKey, DetectorEvaluation] = {}

        tainted = False

        for group_key, value in grouped_values.items():
            trigger_evaluation, priority = self.evaluate_conditions(value)

            if trigger_evaluation is None:
                continue

            tainted = tainted or trigger_evaluation.is_tainted()

            if priority == DetectorPriorityLevel.OK:
                continue

            results[group_key] = self._build_detector_evaluation(
                group_key, priority, trigger_evaluation, data_packet
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

    def get_occurrence_id(self, event_data: EventData) -> str:
        id_in_event_data = event_data.get("event_id")

        if id_in_event_data:
            return id_in_event_data

        return str(uuid4())

    def get_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        if group_key is None:
            return [f"detector:{self.detector.id}"]

        return [f"detector:{self.detector.id}:{group_key}"]

    def _extract_value_from_packet(
        self,
        data_packet: DataPacket[DataPacketType],
    ) -> dict[DetectorGroupKey, DataPacketEvaluationType]:
        """
        This method will normalize the extracted value to support grouping results.

        If `extract_value` returns a `dict[DetectorGroupKey, DataPacketEvaluationType]`
        it will cast it to the correct data type.

        If `extract_value` returns a single value, it will be wrapped in a dict
        with `None` as the key, to normalize the type as `dict[DetectorGroupKey, DataPacketEvaluationType]`.
        """
        data_values = self.extract_value(data_packet)

        if self._is_detector_group_value(data_values):
            return cast(dict[DetectorGroupKey, DataPacketEvaluationType], data_values)

        return {None: cast(DataPacketEvaluationType, data_values)}

    def _is_detector_group_value(self, value: Any) -> bool:
        """
        Check if value is dict[DetectorGroupKey, DataPacketEvaluationType]

        An empty dict is a grouped value with no groups to evaluate.
        """
        if not isinstance(value, dict):
            return False

        return all(isinstance(key, DetectorGroupKey) for key in value.keys())

    def _build_detector_evaluation(
        self,
        group_key: DetectorGroupKey,
        priority: DetectorPriorityLevel,
        trigger_evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[DataPacketType],
    ) -> DetectorEvaluation:
        detector_occurrence, event_data = self.create_occurrence(
            trigger_evaluation, data_packet, priority
        )

        occurrence_id = self.get_occurrence_id(event_data)

        issue_fingerprint = self.get_issue_fingerprint(group_key)

        issue_occurrence = detector_occurrence.to_issue_occurrence(
            occurrence_id=occurrence_id,
            project_id=self.detector.project_id,
            status=priority,
            additional_evidence_data={},
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
