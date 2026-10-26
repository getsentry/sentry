import abc
import dataclasses
import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID, uuid4, uuid5

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.base import camel_to_snake_case, convert_dict_key_case
from sentry.issues.grouptype import GroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.types.actor import Actor
from sentry.workflow_engine.caches.data_source import (
    get_data_sources_by_detector_and_source_id,
)
from sentry.workflow_engine.handlers.detector_outcome import DetectorOutcome
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors import DataConditionGroupEvaluation, DetectorEvaluation
from sentry.workflow_engine.types import (
    DetectorGroupKey,
    DetectorId,
    DetectorPriorityLevel,
)

logger = logging.getLogger(__name__)

DataPacketType = TypeVar("DataPacketType")
DataPacketEvaluationType = TypeVar("DataPacketEvaluationType")

EventData = dict[str, Any]

# An arbitrary namespace to deterministically convert human-readable occurrence IDs to UUIDs
OCCURRENCE_ID_NAMESPACE = UUID("6afca79a-539b-4d79-a781-1d3e7ea844ca")


class DetectorGroupValues(dict[DetectorGroupKey, DataPacketEvaluationType]):
    """
    Return from `extract_value` to evaluate each group key independently.

    Grouping is explicit so a value that is itself a dict is never mistaken for grouped
    values, and so an empty instance means there is nothing in the packet to evaluate.
    """


@dataclass
class EvidenceData(Generic[DataPacketEvaluationType]):
    value: DataPacketEvaluationType
    detector_id: DetectorId
    data_packet_source_id: str
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
        event_id: str,
        project_id: int,
        status: DetectorPriorityLevel,
        additional_evidence_data: Mapping[str, Any],
        fingerprint: list[str],
    ) -> IssueOccurrence:
        return IssueOccurrence(
            id=occurrence_id,
            project_id=project_id,
            event_id=event_id,
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

    on_complete: Callable[[Detector, DetectorEvaluation], None] = (
        DetectorOutcome.ISSUE_PLATFORM.dispatch
    )

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
    ) -> DataPacketEvaluationType | DetectorGroupValues[DataPacketEvaluationType]:
        """
        Extracts the evaluation value from the data packet to be processed.

        Return `DetectorGroupValues` to evaluate each group independently.
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

    def get_event_id(self, event_data: EventData) -> str:
        id_in_event_data = event_data.get("event_id")

        if id_in_event_data:
            return id_in_event_data

        return str(uuid4())

    def get_occurrence_id(self, group_key: DetectorGroupKey, event_id: str) -> str:
        """
        Deterministically converts a human-readable occurrence ID to a UUID, the type expected by the issue platform

        If the detector uses a grouped evaluation AND derives the event id from `event_data`, then the occurrence id
        MUST be unique for each group. Otherwise, each group will generate the same event + occurrence id pairs and they
        will conflict with each other. The occurrence_id_key ensures this uniqueness.
        """
        if group_key is None:
            occurrence_id_key = f"detector:{self.detector.id}:event:{event_id}"
        else:
            occurrence_id_key = f"detector:{self.detector.id}:group:{group_key}:event:{event_id}"

        return uuid5(OCCURRENCE_ID_NAMESPACE, occurrence_id_key).hex

    def get_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        if group_key is None:
            return [f"detector:{self.detector.id}"]

        return [f"detector:{self.detector.id}:{group_key}"]

    def _extract_value(
        self,
        data_packet: DataPacket[DataPacketType],
    ) -> dict[DetectorGroupKey, DataPacketEvaluationType]:
        """
        Normalizes the output of `extract_value` to group key and value pairs.

        `DetectorGroupValues` are returned as-is; any other value is keyed by `None`.
        """
        value = self.extract_value(data_packet)

        if isinstance(value, DetectorGroupValues):
            return value

        return {None: value}

    def _build_workflow_engine_evidence_data(
        self,
        group_evaluation: DataConditionGroupEvaluation,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
    ) -> EvidenceData[DataPacketEvaluationType]:
        """
        Build the workflow engine specific evidence data.
        This is data that is common to all detectors.
        """

        triggered_conditions = [
            dict(condition_evaluation.condition.get_snapshot())
            for condition_evaluation in group_evaluation.data["condition_evaluations"]
            if condition_evaluation.triggered
        ]

        return EvidenceData(
            detector_id=self.detector.id,
            value=evaluation_value,
            data_packet_source_id=data_packet.source_id,
            conditions=triggered_conditions,
            config=self.detector.config,
            data_sources=self._build_evidence_data_sources(data_packet.source_id),
        )

    def _build_evidence_data_sources(self, source_id: str) -> list[dict[str, Any]]:
        try:
            data_sources = get_data_sources_by_detector_and_source_id(self.detector.id, source_id)

            if not data_sources:
                logger.warning(
                    "Matching data source not found for detector while generating occurrence evidence data",
                    extra={
                        "detector_id": self.detector.id,
                        "data_packet_source_id": source_id,
                    },
                )

                return []

            # Serializers return camelcased keys, but evidence data should use snakecase
            return convert_dict_key_case(serialize(data_sources), camel_to_snake_case)
        except Exception:
            logger.exception(
                "Failed to serialize data source definition when building workflow engine evidence data"
            )

            return []

    def _build_event_data(
        self,
        event_data: EventData,
        issue_occurrence: IssueOccurrence,
    ) -> EventData:
        return {
            # Default values
            "environment": self.detector.config.get("environment"),
            "platform": "python",
            "received": issue_occurrence.detection_time,
            "tags": {},
            # Override Data
            **event_data,
            "event_id": issue_occurrence.event_id,
            "project_id": issue_occurrence.project_id,
            "timestamp": issue_occurrence.detection_time,
        }
