import abc
import dataclasses
import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, TypeVar, cast
from uuid import UUID

from django.utils import timezone

from sentry.issues.grouptype import GroupType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.types.actor import Actor
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector_outcome import DetectorOutcome
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors import DetectorEvaluation
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


# TODO - Come up with a better name settings for this...
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

    def _evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluation]:
        """
        This method is the entry point for evaluating detectors.

        Life-cycle:
        - extract_value
        - evaluate
        - create_occurrence

        Once this is complete, `process_detectors` will use `on_complete` to determine
        where to deliver / how to handle the results.
        """
        metric_data = {
            "detector_type": self.detector.type,
            "result": "unknown",
        }

        data = self._extract_value(data_packet)

        try:
            detector_evaluation = self.evaluate(data)
        except Exception:
            metric_data["result"] = "failure"

        if detector_evaluation.tainted:
            metric_data["result"] = "tainted"

        metrics.incr(
            "workflow_engine_detector.evaluation",
            tags=metric_data,
            sample_rate=1.0,
        )

        self._create_occurrences(detector_evaluation, data_packet)

    def _extract_value(
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
        group_data_values: dict[DetectorGroupKey, DataPacketEvaluationType] = {}

        # Normalize the type to dict[DetectorGroupKey, DataPacketEvaluationType]
        if self._is_detector_group_value(data_values):
            group_data_values = cast(dict[DetectorGroupKey, DataPacketEvaluationType], data_values)
        else:
            group_data_values = {None: cast(DataPacketEvaluationType, data_values)}

        return group_data_values

    def _create_occurrences(
        self,
        detector_evaluation: DetectorEvaluation,
    ) -> list[DetectorOccurrence]:
        """
        This is the platform method that wraps `create_occurrence`.

        This method will iterate through each issue found by the detector,
        call create_occurrence for each one. After using the hook,
        the occurrence is then decorated by the platform to add all required
        platform data.
        """

        for group_key, evaluation in detector_evaluation.result.items():
            detector_occurrence, event_data = self.create_occurrence(
                evaluation,  # this needs to support non-data condition group evaluations.
                data_packet,
                priority,
            )

            detector_occurrence.to_issue_occurrence()

        return occurrences

    def _build_detector_evidence(
        self,
        evaluation: DetectorEvaluation,
        *,
        data_packet: DataPacket[DataPacketType] | None = None,
        evaluation_value: DataPacketEvaluationType | None = None,
    ) -> EvidenceData[DataPacketEvaluationType]:
        # TODO - Implement this method, it should be a generic version of _build_workflow_engine_evidence_data
        # TODO - Determine how to handle detectors w/o a data_source
        # TODO - Ensure this is generic enough to work w/o data condition groups

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
        evaluation: DetectorEvaluation,  # TODO - figure out how to support this vs the condition group evaluation.
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
