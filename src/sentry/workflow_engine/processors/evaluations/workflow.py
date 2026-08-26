from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, TypedDict

from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.types import (
    DataConditionGroupId,
    WorkflowEventData,
    WorkflowId,
)

from .base import BaseWorkflowEngineEvaluation, EvaluationPhase, EvaluationType
from .condition_group import DataConditionGroupEvaluation

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


@dataclass(frozen=True, kw_only=True)
class WorkflowEvaluation(
    BaseWorkflowEngineEvaluation[
        WorkflowEvaluationResult,
        WorkflowEvaluationData,
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

    workflow_id: WorkflowId
    detector_id: int
    detector_type: str

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

    @property
    def artifact_fields(self) -> dict[str, object]:
        if isinstance(self.result, DeferredWorkflowEvaluationResult):
            triggered_action_ids: list[int] = []
            deferred: dict[str, object] | None = {
                "trigger_group_id": self.result.delayed_when_group_id,
                "filter_group_ids": sorted(self.result.delayed_if_group_ids),
                "passing_filter_group_ids": sorted(self.result.passing_if_group_ids),
            }
        else:
            triggered_action_ids = [action.id for action in self.result]
            deferred = None

        event_data = self.data["event"]
        event_id = (
            event_data.event.event_id
            if isinstance(event_data.event, GroupEvent)
            else event_data.event.id
        )
        return {
            "evaluation_type": EvaluationType.WORKFLOW,
            "evaluation_phase": EvaluationPhase.INITIAL,
            "workflow_id": self.workflow_id,
            "detector_id": self.detector_id,
            "detector_type": self.detector_type,
            "project_id": event_data.event.project_id,
            "event_id": str(event_id) if event_id else None,
            "group_id": event_data.group.id,
            "outcome": self.outcome,
            "triggered_action_ids": triggered_action_ids,
            **({"deferred": deferred} if deferred else {}),
            "trigger_group_evaluation": self.data.get("trigger_group_eval").to_artifact(),
            "filter_group_evaluations": [
                evaluation.to_artifact() for evaluation in self.data.get("filter_group_evals")
            ],
        }


@dataclass(frozen=True, kw_only=True)
class ProcessWorkflowsResult:
    evaluations: dict[WorkflowId, WorkflowEvaluation]
    outcome: WorkflowEvaluationOutcome
    project_id: int
    group_id: int
    event_id: str | None
    detector_id: int | None = None
    detector_type: str | None = None

    def has_triggered_actions(self) -> bool:
        return any(
            not isinstance(evaluation.result, DeferredWorkflowEvaluationResult)
            and bool(evaluation.result)
            for evaluation in self.evaluations.values()
        )

    def to_artifact(self) -> dict[str, object]:
        return {
            "evaluation_type": EvaluationType.WORKFLOW,
            "evaluation_phase": EvaluationPhase.INITIAL,
            "outcome": self.outcome,
            "project_id": self.project_id,
            "group_id": self.group_id,
            "event_id": self.event_id,
            "detector_id": self.detector_id,
            "detector_type": self.detector_type,
            "error": None,
        }
