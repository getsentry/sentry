from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, TypedDict

from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.types import (
    ActionId,
    DataConditionGroupId,
    DetectorId,
    GroupId,
    WorkflowEventData,
    WorkflowId,
)

from .base import (
    BaseWorkflowEngineEvaluation,
    BaseWorkflowEngineEvaluationArtifact,
    EvaluationPhase,
    EvaluationType,
)
from .condition_group import DataConditionGroupEvaluation, DataConditionGroupEvaluationArtifact

if TYPE_CHECKING:
    from sentry.workflow_engine.models import Action


@dataclass(frozen=True, kw_only=True)
class DeferredWorkflowEvaluationResult:
    delayed_when_group_id: DataConditionGroupId | None
    delayed_if_group_ids: frozenset[DataConditionGroupId]
    passing_if_group_ids: frozenset[DataConditionGroupId]


type WorkflowEvaluationResult = Sequence[Action] | DeferredWorkflowEvaluationResult


class WorkflowEvaluationOutcome(StrEnum):
    # Error Outcomes
    ENVIRONMENT_NOT_FOUND = "environment_not_found"
    ERROR = "error"
    NO_DETECTOR = "no_detector"
    NO_WORKFLOWS = "no_workflows"

    # Finished evaluation outcomes
    ACTIONS_TRIGGERED = "actions_triggered"
    COMPLETED = "completed"
    DEFERRED = "deferred"
    NO_ACTIONS = "no_actions"
    NOT_TRIGGERED = "not_triggered"


class WorkflowEvaluationData(TypedDict):
    """
    Track all of the data that went into evaluating a single workflow.

    # TODO - Should this also include the DetectorWorkflow information?

    `trigger_group_eval`: The evaluation of the conditions for triggering a workflow.
    `filter_group_evals`: All of the condition groups that determine if an action should be triggered.
    `event`: The data that started the workflow's evaluation.
    """

    trigger_group_eval: DataConditionGroupEvaluation
    filter_group_evals: Sequence[DataConditionGroupEvaluation]
    event: WorkflowEventData


@dataclass(frozen=True)
class DeferredWorkflowData:
    trigger_group_id: DataConditionGroupId | None
    filter_group_ids: Sequence[DataConditionGroupId]
    passing_filter_group_ids: Sequence[DataConditionGroupId]


@dataclass(frozen=True)
class WorkflowEvaluationArtifact(BaseWorkflowEngineEvaluationArtifact):
    detector_type: str
    evaluation_phase: EvaluationPhase
    evaluation_type: EvaluationType
    filter_evaluations: Sequence[DataConditionGroupEvaluationArtifact]
    group_id: GroupId
    outcome: WorkflowEvaluationOutcome
    project_id: int
    trigger_evaluation: DataConditionGroupEvaluationArtifact
    triggered_action_ids: Sequence[ActionId]
    workflow_id: WorkflowId
    deferred: DeferredWorkflowData | None = None
    detector_id: DetectorId | None = None
    event_id: str | None = None


@dataclass(frozen=True, kw_only=True)
class WorkflowEvaluation(
    BaseWorkflowEngineEvaluation[
        WorkflowEvaluationResult,
        WorkflowEvaluationData,
        WorkflowEvaluationArtifact,
    ]
):
    """
    Stores the evaluation of a single workflow.

    Inherited Properties
    - `result`: The actions triggered from the workflow, or deferred evaluation details
        when there are slow conditions to batch evaluate.
    - `data`: WorkflowEvaluationData
    - `error`: ConditionError - Set when there's an error while evaluating the workflow.
    - `triggered`: bool - Whether the workflow's trigger (WHEN) conditions passed.
    """

    detector_id: int
    detector_type: str
    workflow_id: WorkflowId

    @property
    def outcome(self) -> WorkflowEvaluationOutcome:
        if isinstance(self.result, DeferredWorkflowEvaluationResult):
            return WorkflowEvaluationOutcome.DEFERRED
        if self.error or any(evaluation.error for evaluation in self.data["filter_group_evals"]):
            return WorkflowEvaluationOutcome.ERROR
        if not self.triggered:
            return WorkflowEvaluationOutcome.NOT_TRIGGERED

        if self.result:
            return WorkflowEvaluationOutcome.ACTIONS_TRIGGERED
        return WorkflowEvaluationOutcome.NO_ACTIONS

    def _build_artifact(self, *, triggered: bool, error: str | None) -> WorkflowEvaluationArtifact:
        if isinstance(self.result, DeferredWorkflowEvaluationResult):
            triggered_action_ids: list[int] = []
            deferred: DeferredWorkflowData | None = DeferredWorkflowData(
                trigger_group_id=self.result.delayed_when_group_id,
                filter_group_ids=sorted(self.result.delayed_if_group_ids),
                passing_filter_group_ids=sorted(self.result.passing_if_group_ids),
            )
        else:
            triggered_action_ids = [action.id for action in self.result]
            deferred = None

        event_data = self.data["event"]
        event_id = (
            event_data.event.event_id
            if isinstance(event_data.event, GroupEvent)
            else event_data.event.id
        )
        return WorkflowEvaluationArtifact(
            triggered=triggered,
            error=error,
            deferred=deferred,
            detector_id=self.detector_id,
            detector_type=self.detector_type,
            evaluation_phase=EvaluationPhase.INITIAL,
            evaluation_type=EvaluationType.WORKFLOW,
            event_id=str(event_id) if event_id else None,
            filter_evaluations=[
                evaluation.to_artifact() for evaluation in self.data.get("filter_group_evals")
            ],
            group_id=event_data.group.id,
            outcome=self.outcome,
            project_id=event_data.event.project_id,
            trigger_evaluation=self.data.get("trigger_group_eval").to_artifact(),
            triggered_action_ids=triggered_action_ids,
            workflow_id=self.workflow_id,
        )


@dataclass(frozen=True, kw_only=True)
class ProcessWorkflowsResult:
    detector_id: int | None = None
    detector_type: str | None = None
    evaluations: dict[WorkflowId, WorkflowEvaluation]
    event_id: str | None
    group_id: int
    outcome: WorkflowEvaluationOutcome
    project_id: int

    def has_triggered_actions(self) -> bool:
        return any(
            not isinstance(evaluation.result, DeferredWorkflowEvaluationResult)
            and bool(evaluation.result)
            for evaluation in self.evaluations.values()
        )

    def to_artifact(self) -> dict[str, object]:
        return {
            "detector_id": self.detector_id,
            "detector_type": self.detector_type,
            "error": None,
            "evaluation_phase": EvaluationPhase.INITIAL,
            "evaluation_type": EvaluationType.WORKFLOW,
            "event_id": self.event_id,
            "group_id": self.group_id,
            "outcome": self.outcome,
            "project_id": self.project_id,
        }
