from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import TypedDict

from sentry.workflow_engine.types import (
    WORKFLOW_EVALUATION_DEFERRED,
    DataConditionGroupId,
    WorkflowEvaluationResult,
    WorkflowEventData,
    WorkflowId,
)

from .base import BaseWorkflowEngineEvaluation
from .condition_group import DataConditionGroupEvaluation


class DeferredWorkflowEvaluationData(TypedDict):
    delayed_when_group_id: DataConditionGroupId | None
    delayed_if_group_ids: list[DataConditionGroupId]
    passing_if_group_ids: list[DataConditionGroupId]


class WorkflowEvaluationData(TypedDict):
    """
    Track all of the data that went into evaluating a single workflow.

    # TODO - Should this also include the DetectorWorkflow information?

    `trigger_group_eval`: The evaluation of the conditions for triggering a workflow.
    `filter_group_evals`: All of the condition groups that determine if an action should be triggered.
    `event`: The data that started the workflow's evaluation.
    `deferred`: A snapshot of condition-group IDs pending slow evaluation.
    """

    trigger_group_eval: DataConditionGroupEvaluation
    filter_group_evals: Sequence[DataConditionGroupEvaluation]
    event: WorkflowEventData
    deferred: DeferredWorkflowEvaluationData | None


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
    - `result`: The actions that are triggered from the workflow, or the "deferred"
        sentinel when there are slow conditions to batch evaluate.
    - `data`: WorkflowEvaluationData
    - `error`: ConditionError - Set when there's an error while evaluating the workflow.
    - `triggered`: bool - Whether the workflow's trigger (WHEN) conditions passed.
    """

    workflow_id: WorkflowId
    detector_id: int
    detector_type: str

    def _artifact_data(self) -> dict[str, object]:
        if self.result == WORKFLOW_EVALUATION_DEFERRED:
            result_type = "deferred"
            triggered_action_ids: list[int] = []
        else:
            result_type = "actions"
            triggered_action_ids = [action.id for action in self.result]

        event_data = self.data["event"]
        event_id = getattr(event_data.event, "event_id", None)
        return {
            "workflow_id": self.workflow_id,
            "detector_id": self.detector_id,
            "detector_type": self.detector_type,
            "event_id": str(event_id) if event_id else None,
            "group_id": event_data.group.id,
            "result_type": result_type,
            "triggered_action_ids": triggered_action_ids,
            "deferred": self.data["deferred"],
            "trigger_group_evaluation": self.data["trigger_group_eval"].to_artifact(),
            "filter_group_evaluations": [
                evaluation.to_artifact() for evaluation in self.data["filter_group_evals"]
            ],
        }


def has_triggered_actions(evaluations: Mapping[WorkflowId, WorkflowEvaluation]) -> bool:
    return any(
        evaluation.result != WORKFLOW_EVALUATION_DEFERRED and bool(evaluation.result)
        for evaluation in evaluations.values()
    )
