from dataclasses import dataclass
from enum import StrEnum
from typing import Any, TypedDict

from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel, DetectorResult

from .base import BaseWorkflowEngineEvaluation
from .condition_group import DataConditionGroupEvaluation


class DetectorEvaluationData(TypedDict):
    group_key: DetectorGroupKey
    trigger_group_evaluation: DataConditionGroupEvaluation
    event_data: dict[str, Any] | None  # TODO - improve this typing, for now migrating


class DetectorEvaluationOutcome(StrEnum):
    COMPLETED = "completed"
    NO_RESULTS = "no_results"


@dataclass(frozen=True, kw_only=True)
class DetectorEvaluation(
    BaseWorkflowEngineEvaluation[
        DetectorResult,
        DetectorEvaluationData,
    ]
):
    """
    Defines the Evaluation of a Detector.

    Properties
    - priority: DetectorPriorityLevel - The resulting priority for the detector

    Inherited properties
    - result: DetectorResult - The information to send to the issue platforms Kafka topic,
        each individual DetectorHandler will determine if they should create a new issue (IssueOccurrence)
        or if it will send an update to an existing Issue (StatusChangeMessage). Set to None when the detector
        is not triggered. By default this is set to None, to signify a detector's not expected to be triggered.
    - data: DetectorEvaluationData - This data includes the group key (DetectorGroupKey), the evaluation of the Detector
        triggers (DataConditionGroupEvaluation), and the event data (dict) that triggered the detector evaluation.
    - error: ConditionError - An error during the processing of the conditions in the trigger group.
    - triggered: bool - If there is an event that should trigger the next phase in the system.
    """

    result: DetectorResult = None
    priority: DetectorPriorityLevel

    @property
    def artifact_fields(self) -> dict[str, Any]:
        # Each trigger group evaluation will log the value used in evaluation
        # We only need to extract the top level detector items for tracking here.
        return {
            "group_key": self.data["group_key"],
            "priority": self.priority.value,
            "trigger_group_evaluation": self.data["trigger_group_evaluation"].to_artifact(),
        }


@dataclass(frozen=True, kw_only=True)
class ProcessDetectorsResult:
    detector_id: int
    detector_type: str
    project_id: int | None
    evaluations: dict[DetectorGroupKey, DetectorEvaluation]

    @property
    def outcome(self) -> DetectorEvaluationOutcome:
        if self.evaluations:
            return DetectorEvaluationOutcome.COMPLETED
        return DetectorEvaluationOutcome.NO_RESULTS

    def to_artifact(self) -> dict[str, object]:
        return {
            "detector_id": self.detector_id,
            "detector_type": self.detector_type,
            "project_id": self.project_id,
            "outcome": self.outcome,
        }

    def evaluation_artifacts(self) -> list[dict[str, object]]:
        detector_artifact = self.to_artifact()
        if not self.evaluations:
            return [detector_artifact]

        return [
            {**detector_artifact, **evaluation.to_artifact()}
            for evaluation in self.evaluations.values()
        ]
