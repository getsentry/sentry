import abc
import dataclasses
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, TypeVar

from django.utils import timezone

from sentry.issues.grouptype import GroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.types.actor import Actor
from sentry.utils import metrics
from sentry.workflow_engine.models import DataConditionGroup, DataPacket, Detector
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)

logger = logging.getLogger(__name__)

DataPacketType = TypeVar("DataPacketType")
DataPacketEvaluationType = TypeVar("DataPacketEvaluationType")

EventData = dict[str, Any]


@dataclass
class EvidenceData(Generic[DataPacketEvaluationType]):
    value: DataPacketEvaluationType
    detector_id: int
    data_packet_source_id: int
    conditions: list[dict[str, Any]]
    config: dict[str, Any] = dataclasses.field(default_factory=dict, kw_only=True)
    data_sources: list[dict[str, Any]] = dataclasses.field(default_factory=list, kw_only=True)


@dataclasses.dataclass(frozen=True, kw_only=True)
class DetectorOccurrence:
    """
    Represents a detector observation at any priority level (issue detection or resolution).
    Created by detector handlers for both problem states (HIGH/MEDIUM/LOW) and resolved states (OK).
    """

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
    result: dict[DetectorGroupKey, DetectorEvaluationResult]
    tainted: bool


# TODO - @saponifi3d - Change this class to be a pure ABC and remove the `__init__` method.
# TODO - @saponifi3d - Once the change is made, we should introduce a `BaseDetector` class to evaluate simple cases
class DetectorHandler(abc.ABC, Generic[DataPacketType, DataPacketEvaluationType]):
    def __init__(self, detector: Detector):
        self.detector = detector
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
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        tags = {
            "detector_type": self.detector.type,
            "result": "unknown",
        }
        try:
            value = self.evaluate_impl(data_packet)
            tags["result"] = "tainted" if value.tainted else "success"
            metrics.incr("workflow_engine_detector.evaluation", tags=tags, sample_rate=1.0)
            return value.result
        except Exception:
            tags["result"] = "failure"
            metrics.incr("workflow_engine_detector.evaluation", tags=tags, sample_rate=1.0)
            raise

    @abc.abstractmethod
    def evaluate_impl(
        self, data_packet: DataPacket[DataPacketType]
    ) -> GroupedDetectorEvaluationResult:
        """
        This method is used to evaluate the data packet's value against the conditions on the detector.
        """
        pass

    @abc.abstractmethod
    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[DataPacketType],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        """
        Creates a DetectorOccurrence for the current detector state at any priority level.
        Called for both issue detection (HIGH/MEDIUM/LOW) and resolution (OK).

        This method provides the value that was evaluated against, the data packet that was
        used to get the data, and the condition evaluation results.

        To implement this, you will need to create a new `DetectorOccurrence` object,
        to represent the detector's observation. Additionally, you can return any
        event_data to associate with the occurrence.
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
    def extract_dedupe_value(self, data_packet: DataPacket[DataPacketType]) -> int:
        """
        Extracts the de-duplication value from a passed data packet. This duplication
        value is used to determine if we've already processed data to this point or not.

        This is normally a timestamp, but could be any sortable value; (e.g. a sequence number, timestamp, etc).
        """
        pass
