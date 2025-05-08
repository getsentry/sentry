import abc
import dataclasses
import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, TypeVar

from sentry.issues.grouptype import GroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.types.actor import Actor
from sentry.workflow_engine.models import Condition, DataConditionGroup, DataPacket, Detector
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel

logger = logging.getLogger(__name__)

DataPacketType = TypeVar("DataPacketType")
DataPacketEvaluationType = TypeVar("DataPacketEvaluationType")


@dataclass
class EvidenceData(Generic[DataPacketEvaluationType]):
    value: DataPacketEvaluationType
    detector_id: int
    data_source_ids: list[int]
    data_condition_ids: list[int]
    data_condition_type: Condition
    # Represents the actual value that we are comparing against
    data_condition_comparison_value: DataPacketEvaluationType


@dataclasses.dataclass(frozen=True, kw_only=True)
class DetectorOccurrence:
    issue_title: str
    subtitle: str
    resource_id: str | None = None
    evidence_data: Mapping[str, Any] = dataclasses.field(default_factory=dict)
    evidence_display: Sequence[IssueEvidence] = dataclasses.field(default_factory=list)
    type: type[GroupType]
    level: str
    culprit: str
    priority: int | None = None
    assignee: Actor | None = None

    def to_issue_occurrence(
        self,
        *,
        occurrence_id: str,
        project_id: int,
        status: DetectorPriorityLevel,
        detection_time: datetime,
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
            detection_time=detection_time,
            level=self.level,
            culprit=self.culprit,
            priority=self.priority or status,
            assignee=self.assignee,
        )


@dataclasses.dataclass(frozen=True)
class DetectorEvaluationResult:
    # TODO - Should group key live at this level?
    group_key: DetectorGroupKey
    # TODO: Are these actually necessary? We're going to produce the occurrence in the detector, so we probably don't
    # need to know the other results externally
    is_triggered: bool
    priority: DetectorPriorityLevel
    # TODO: This is only temporarily optional. We should always have a value here if returning a result
    result: IssueOccurrence | StatusChangeMessage | None = None
    # Event data to supplement the `IssueOccurrence`, if passed.
    event_data: dict[str, Any] | None = None


class DetectorHandler(abc.ABC, Generic[DataPacketType]):
    def __init__(self, detector: Detector):
        self.detector = detector
        if detector.workflow_condition_group_id is not None:
            try:
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

    @abc.abstractmethod
    def evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        pass
