from dataclasses import dataclass, replace
from enum import StrEnum
from typing import Any, Self, TypedDict

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
    # Only set for detectors that evaluate a data condition group
    trigger_group_evaluation: DataConditionGroupEvaluation | None
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
    trigger_evaluation: DataConditionGroupEvaluationArtifact | None


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

    Detector handlers SHOULD build evaluations with the named constructors, which state the
    intended outcome and keep `triggered`, `priority`, and `result` consistent:

    - `DetectorEvaluation.create_issue(...)`: the group triggered at a non-OK priority. The
      handler attaches the `IssueOccurrence` it builds with `with_result`.
    - `evaluation.with_result(...)`: a copy carrying a built `IssueOccurrence` or
      `StatusChangeMessage`, e.g. a resolution from a stateful detector.
    - `DetectorEvaluation.ok(...)`: the group evaluated as OK. It carries no result unless a
      handler attaches a resolution with `with_result`.

    Evaluations with a result are passed to the detector handler's `on_complete`, which decides
    what to do with them. The default, `DetectorOutcome.ISSUE_PLATFORM`, sends them to the Issue Platform.

    Properties
    - priority: DetectorPriorityLevel - The resulting priority for the detector

    Inherited properties
    - result: DetectorResult - An occurrence (IssueOccurrence) or a status change for an existing issue
        (StatusChangeMessage), passed to the detector handler's `on_complete`.
        None when there is no result yet: a `create_issue` evaluation before its occurrence is attached,
        or an `ok` evaluation without a resolution.
    - data: DetectorEvaluationData - This data includes the group key (DetectorGroupKey), the evaluation of the Detector
        triggers (DataConditionGroupEvaluation), and the event data (dict) that triggered the detector evaluation.
    - error: ConditionError - An error during the processing of the conditions in the trigger group.
    - triggered: bool - If there is an event that should trigger the next phase in the system.
    """

    result: DetectorResult = None
    priority: DetectorPriorityLevel

    @classmethod
    def create_issue(
        cls,
        group_key: DetectorGroupKey,
        priority: DetectorPriorityLevel,
        trigger_group_evaluation: DataConditionGroupEvaluation | None = None,
    ) -> Self:
        """
        The group triggered at `priority`. The handler attaches the `IssueOccurrence` it builds
        with `with_result`.

        `trigger_group_evaluation` is the condition group evaluation that decided the
        priority, or None for detectors that do not evaluate one.
        """
        if priority == DetectorPriorityLevel.OK:
            raise ValueError("An OK priority cannot trigger; use `DetectorEvaluation.ok` instead")

        return cls(
            result=None,
            data=DetectorEvaluationData(
                group_key=group_key,
                trigger_group_evaluation=trigger_group_evaluation,
                event_data=None,
            ),
            triggered=True,
            priority=priority,
        )

    @classmethod
    def ok(
        cls,
        group_key: DetectorGroupKey,
        trigger_group_evaluation: DataConditionGroupEvaluation | None = None,
    ) -> Self:
        """
        The group evaluated as OK. The evaluation carries no result; a handler that resolves
        the issue, e.g. `StatefulDetectorHandler`, attaches the resolution with `with_result`.
        """
        return cls(
            result=None,
            data=DetectorEvaluationData(
                group_key=group_key,
                trigger_group_evaluation=trigger_group_evaluation,
                event_data=None,
            ),
            triggered=False,
            priority=DetectorPriorityLevel.OK,
        )

    def with_result(
        self,
        result: IssueOccurrence | StatusChangeMessage,
        *,
        event_data: dict[str, Any] | None = None,
    ) -> Self:
        """
        Returns a copy of this evaluation carrying a built result. `event_data` replaces the
        evaluation's event data when given.
        """
        return replace(
            self,
            result=result,
            data=DetectorEvaluationData(
                group_key=self.data["group_key"],
                trigger_group_evaluation=self.data["trigger_group_evaluation"],
                event_data=event_data if event_data is not None else self.data["event_data"],
            ),
        )

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
        trigger_group_evaluation = self.data["trigger_group_evaluation"]
        return DetectorEvaluationArtifact(
            triggered=triggered,
            error=error,
            event_id=str(event_id) if event_id else None,
            group_key=self.data["group_key"],
            outcome=self.outcome,
            priority=self.priority.value,
            trigger_evaluation=(
                trigger_group_evaluation.to_artifact() if trigger_group_evaluation else None
            ),
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
