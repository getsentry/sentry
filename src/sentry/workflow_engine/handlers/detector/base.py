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
from sentry.utils import metrics
from sentry.workflow_engine.caches.data_source import (
    get_data_sources_by_detector_and_source_id,
)
from sentry.workflow_engine.handlers.detector_outcome import DetectorOutcome
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors import DetectorEvaluation
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
class DetectorEvaluations:
    """
    The evaluations `evaluate` decided on, keyed by group, and whether any condition errored.
    """

    result: dict[DetectorGroupKey, DetectorEvaluation]
    tainted: bool


class BaseDetectorHandler(abc.ABC, Generic[DataPacketType, DataPacketEvaluationType]):
    """
    Base class for detector handlers.

    DataPacketType is what we've embedded within the data packet.
    DataPacketEvaluationType is the type of the value extracted from the data packet and
    evaluated by the detector.

    Subclasses implement `extract_value`, `evaluate`, and `create_occurrence`. The platform
    composes them in `_evaluate`, and builds the issue occurrence for every triggered evaluation.
    """

    def __init__(self, detector: Detector):
        self.detector = detector

    on_complete: Callable[[Detector, DetectorEvaluation], None] = (
        DetectorOutcome.ISSUE_PLATFORM.dispatch
    )

    @abc.abstractmethod
    def extract_value(
        self, data_packet: DataPacket[DataPacketType]
    ) -> DataPacketEvaluationType | DetectorGroupValues[DataPacketEvaluationType]:
        """
        Extracts the value to evaluate from the data packet.

        Return `DetectorGroupValues` to evaluate each group independently. An empty
        `DetectorGroupValues` skips evaluation, e.g. for packets the detector filters out.
        """
        pass

    @abc.abstractmethod
    def evaluate(
        self,
        data_packet: DataPacket[DataPacketType],
        values: Mapping[DetectorGroupKey, DataPacketEvaluationType],
    ) -> DetectorEvaluations:
        """
        Decides the outcome for each group's extracted value. Ungrouped detectors receive a single value keyed by `None`.

        Return a triggered `DetectorEvaluation` with `result=None` for each group that should create an issue;
        the platform will call `create_occurrence` and build the `IssueOccurrence` for it. An evaluation that
        already carries a result, like a `StatusChangeMessage`, is returned as-is. Evaluations that are neither
        triggered nor carry a result have no outcome and are dropped.
        """
        pass

    @abc.abstractmethod
    def create_occurrence(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[DataPacketType],
    ) -> tuple[DetectorOccurrence, EventData]:
        """
        This method provides the triggered evaluation and the data packet that was used to get the data.
        `evaluation.priority` is the priority the detector triggered at.

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

    def _evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluation]:
        """
        This method is the entry point for evaluating detectors.

        Life-cycle:
        - extract_value
        - evaluate, skipped when there are no groups to evaluate
        - create_occurrence, for each triggered evaluation without a result

        Once this is complete, `process_detectors` will use `on_complete` to determine
        where to deliver / how to handle the results.
        """
        tags = {
            "detector_type": self.detector.type,
            "result": "unknown",
        }

        try:
            values = self._extract_value(data_packet)
            evaluations = (
                self.evaluate(data_packet, values)
                if values
                else DetectorEvaluations(result={}, tainted=False)
            )
            results: dict[DetectorGroupKey, DetectorEvaluation] = {}

            for group_key, evaluation in evaluations.result.items():
                if evaluation.result is not None:
                    results[group_key] = evaluation
                elif evaluation.triggered:
                    results[group_key] = self._create_occurrence(
                        evaluation, data_packet, values[group_key]
                    )
        except Exception:
            tags["result"] = "failure"

            metrics.incr("workflow_engine_detector.evaluation", tags=tags, sample_rate=1.0)

            raise

        tags["result"] = "tainted" if evaluations.tainted else "success"

        metrics.incr("workflow_engine_detector.evaluation", tags=tags, sample_rate=1.0)

        return results

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

    def _create_occurrence(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
        *,
        fingerprint: list[str] | None = None,
    ) -> DetectorEvaluation:
        """
        This is the platform method that wraps `create_occurrence`.

        The occurrence from the hook is decorated with the platform's identifiers, fingerprint,
        evidence data, and event data, then set as the result of the evaluation.

        `fingerprint` defaults to `get_issue_fingerprint` for the evaluation's group key.
        """
        detector_occurrence, event_data = self.create_occurrence(evaluation, data_packet)

        group_key = evaluation.data["group_key"]
        event_id = self.get_event_id(event_data)
        evidence_data = self._build_detector_evidence(evaluation, data_packet, evaluation_value)

        issue_occurrence = detector_occurrence.to_issue_occurrence(
            occurrence_id=self.get_occurrence_id(group_key, event_id),
            event_id=event_id,
            project_id=self.detector.project_id,
            status=evaluation.priority,
            additional_evidence_data=dataclasses.asdict(evidence_data),
            fingerprint=fingerprint or self.get_issue_fingerprint(group_key),
        )

        return dataclasses.replace(
            evaluation,
            result=issue_occurrence,
            data=DetectorEvaluationData(
                group_key=group_key,
                trigger_group_evaluation=evaluation.data["trigger_group_evaluation"],
                event_data=self._build_event_data(event_data, issue_occurrence),
            ),
        )

    def _build_detector_evidence(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
    ) -> EvidenceData[DataPacketEvaluationType]:
        """
        Build the workflow engine evidence data, common to all detectors.

        `conditions` are the triggered conditions of the evaluation's trigger group, and are empty
        for detectors that don't evaluate a data condition group. `data_sources` are empty when
        the packet's source is not connected to the detector.
        """
        trigger_evaluation = evaluation.data["trigger_group_evaluation"]
        triggered_conditions: list[dict[str, Any]] = []

        if trigger_evaluation is not None:
            triggered_conditions = [
                dict(condition_evaluation.condition.get_snapshot())
                for condition_evaluation in trigger_evaluation.data["condition_evaluations"]
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
