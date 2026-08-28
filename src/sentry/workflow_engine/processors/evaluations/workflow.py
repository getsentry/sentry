from __future__ import annotations

from collections.abc import Mapping, Sequence
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

    `trigger_group_id`: The condition group used to trigger the workflow, if present.
    `trigger_group_eval`: The evaluation of the conditions for triggering a workflow.
    `filter_group_evals`: Action-filter evaluations keyed by condition group ID.
    `event`: The data that started the workflow's evaluation.
    """

    trigger_group_id: DataConditionGroupId | None
    trigger_group_eval: DataConditionGroupEvaluation
    filter_group_evals: Mapping[DataConditionGroupId, DataConditionGroupEvaluation]
    event: WorkflowEventData


def _condition_group_artifact(
    condition_group_id: DataConditionGroupId | None,
    evaluation: DataConditionGroupEvaluation,
) -> dict[str, object]:
    return {
        "condition_group_id": condition_group_id,
        **evaluation.to_artifact(),
    }


@dataclass(frozen=True, kw_only=True)
class WorkflowEvaluationArtifact:
    evaluation_type: EvaluationType
    evaluation_phase: EvaluationPhase
    workflow_id: WorkflowId
    detector_id: DetectorId | None
    detector_type: str | None
    event_iid: str | None
    group_id: GroupId
    outcome: WorkflowEvaluationOutcome
    triggered_action_ids: Sequence[ActionId]
    trigger_group_evaluation: Mapping[DataConditionGroupId, DataConditionGroupEvaluation]
    filter_group_evaluations: Mapping[DataConditionGroupId, DataConditionGroupEvaluation]


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
        if self.error or any(
            evaluation.error for evaluation in self.data["filter_group_evals"].values()
        ):
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

        trigger_group_id = self.data.get("trigger_group_id")
        trigger_evaluations = self.data.get("trigger_group_eval", {})
        filter_evaluations = self.data.get("filter_group_evals", {})

        artifact = WorkflowEvaluationArtifact(
            phase=EvaluationPhase.INITIAL,
            workflow_id=self.workflow_id,
            detector_id=self.detector_id,
            detector_type=self.detector_type,
            project_id=event_data.event.project_id,
            event_id=str(event_id) if event_id else None,
            group_id=event_data.group.id,
            outcome=self.outcome,
            triggered_action_ids=list(triggered_action_ids),
            trigger_group_evaluation={trigger_group_id: trigger_evaluations.to_artifact()},
            filter_group_evaluations=[
                _condition_group_artifact(condition_group_id, evaluation)
                for condition_group_id, evaluation in sorted(filter_evaluations.items())
            ],
        )

        if deferred is not None:
            artifact["deferred"] = deferred

        return artifact


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
