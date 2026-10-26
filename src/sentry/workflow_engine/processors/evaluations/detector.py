from dataclasses import dataclass
from enum import StrEnum
from typing import Any, TypedDict

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.workflow_engine.types import (
    ConditionError,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorResult,
)

from .base import BaseWorkflowEngineEvaluation, BaseWorkflowEngineEvaluationArtifact
from .condition_group import DataConditionGroupEvaluation, DataConditionGroupEvaluationArtifact


class DetectorEvaluationData(TypedDict):
    group_key: DetectorGroupKey
    trigger_group_evaluation: DataConditionGroupEvaluation
    event_data: dict[str, Any] | None  # TODO - improve this typing, for now migrating


class DetectorEvaluationOutcome(StrEnum):
    COMPLETED = "completed"
    ERROR = "error"
    NO_RESULTS = "no_results"
    NOT_TRIGGERED = "not_triggered"
    RESOLVED = "resolved"
    TRIGGERED = "triggered"


@dataclass(frozen=True)
class DetectorEvaluationArtifact(BaseWorkflowEngineEvaluationArtifact):
    event_id: str | None
    group_key: DetectorGroupKey
    outcome: DetectorEvaluationOutcome
    priority: int
    trigger_evaluation: DataConditionGroupEvaluationArtifact


@dataclass(frozen=True, kw_only=True)
class DetectorEvaluation(
    BaseWorkflowEngineEvaluation[
        DetectorResult,
        DetectorEvaluationData,
        DetectorEvaluationArtifact,
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
    def outcome(self) -> DetectorEvaluationOutcome:
        if self.error:
            return DetectorEvaluationOutcome.ERROR
        if isinstance(self.result, StatusChangeMessage):
            return DetectorEvaluationOutcome.RESOLVED
        if self.triggered or isinstance(self.result, IssueOccurrence):
            return DetectorEvaluationOutcome.TRIGGERED
        return DetectorEvaluationOutcome.NOT_TRIGGERED

    def _build_artifact(self, *, triggered: bool, error: str | None) -> DetectorEvaluationArtifact:
        # Each trigger group evaluation will log the value used in evaluation
        # We only need to extract the top level detector items for tracking here.
        event_data = self.data["event_data"] or {}
        event_id = event_data.get("event_id")
        return DetectorEvaluationArtifact(
            triggered=triggered,
            error=error,
            event_id=str(event_id) if event_id else None,
            group_key=self.data["group_key"],
            outcome=self.outcome,
            priority=self.priority.value,
            trigger_evaluation=self.data["trigger_group_evaluation"].to_artifact(),
        )


@dataclass(frozen=True, kw_only=True)
class ProcessDetectorsResult:
    detector_id: int
    detector_type: str
    project_id: int | None
    evaluations: dict[DetectorGroupKey, DetectorEvaluation]
    error: ConditionError | None = None

    @property
    def evaluation_error(self) -> ConditionError | None:
        return self.error or next(
            (evaluation.error for evaluation in self.evaluations.values() if evaluation.error),
            None,
        )

    @property
    def outcome(self) -> DetectorEvaluationOutcome:
        if self.evaluation_error:
            return DetectorEvaluationOutcome.ERROR
        if self.evaluations:
            return DetectorEvaluationOutcome.COMPLETED
        return DetectorEvaluationOutcome.NO_RESULTS

    def evaluation_artifacts(self) -> tuple[DetectorEvaluationArtifact, ...]:
        return tuple(evaluation.to_artifact() for evaluation in self.evaluations.values())
