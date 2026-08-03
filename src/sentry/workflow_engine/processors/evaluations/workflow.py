from __future__ import annotations

import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypedDict

from sentry_sdk import logger as sentry_logger

from sentry import features, options
from sentry.workflow_engine.types import WorkflowEvaluationResult, WorkflowEventData

from .base import BaseWorkflowEngineEvaluation, EvaluationLog
from .condition_group import DataConditionGroupEvaluation

if TYPE_CHECKING:
    from logging import Logger

    from sentry.models.organization import Organization
    from sentry.workflow_engine.models import Detector
    from sentry.workflow_engine.types import WorkflowId


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


class WorkflowEvaluationLog(EvaluationLog):
    triggered_action_ids: list[int]
    deferred: bool


class WorkflowEvaluationsLog(TypedDict):
    event_id: str | None
    group_id: int
    detection_type: str | None
    workflow_ids: list[int] | None
    triggered_workflow_ids: list[int]
    delayed_conditions: list[str] | None
    action_filter_group_ids: list[int]
    triggered_action_ids: list[int]
    debug_msg: str | None


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

    def to_log(self) -> WorkflowEvaluationLog:
        if self.result == "deferred":
            return {
                **super().to_log(),
                "triggered_action_ids": [],
                "deferred": True,
            }

        return {
            **super().to_log(),
            "triggered_action_ids": [action.id for action in self.result],
            "deferred": False,
        }


def has_triggered_actions(evaluations: Mapping[WorkflowId, WorkflowEvaluation]) -> bool:
    return any(
        evaluation.result != "deferred" and bool(evaluation.result)
        for evaluation in evaluations.values()
    )


def log_workflow_evaluations(
    logger: Logger,
    *,
    organization: Organization,
    event_data: WorkflowEventData,
    evaluations: Mapping[WorkflowId, WorkflowEvaluation],
    detector: Detector | None = None,
    workflow_ids: Sequence[WorkflowId] | None = None,
    delayed_conditions: Sequence[str] | None = None,
    action_filter_group_ids: Sequence[int] = (),
    debug_msg: str | None = None,
) -> bool:
    """Sample and emit a flattened log for a batch of workflow evaluations."""
    should_log = features.has("organizations:workflow-engine-log-evaluations", organization)
    if not should_log:
        should_log = random.random() < options.get("workflow_engine.evaluation_log_sample_rate")

    if not should_log:
        return False

    evaluation_logs = {
        workflow_id: evaluation.to_log() for workflow_id, evaluation in evaluations.items()
    }
    triggered_workflow_ids = sorted(
        workflow_id
        for workflow_id, evaluation_log in evaluation_logs.items()
        if evaluation_log["triggered"]
    )
    triggered_action_ids = sorted(
        action_id
        for evaluation_log in evaluation_logs.values()
        for action_id in evaluation_log["triggered_action_ids"]
    )

    log_name = "workflow_engine.process_workflows.evaluation"
    if triggered_action_ids:
        log_name = f"{log_name}.actions.triggered"
    elif triggered_workflow_ids:
        log_name = f"{log_name}.workflows.triggered"
    else:
        log_name = f"{log_name}.workflows.not_triggered"

    event_id = getattr(event_data.event, "event_id", None)
    extra = WorkflowEvaluationsLog(
        event_id=str(event_id) if event_id else None,
        group_id=event_data.group.id,
        detection_type=detector.type if detector else None,
        workflow_ids=sorted(workflow_ids) if workflow_ids else None,
        triggered_workflow_ids=triggered_workflow_ids,
        delayed_conditions=sorted(delayed_conditions) if delayed_conditions else None,
        action_filter_group_ids=sorted(action_filter_group_ids),
        triggered_action_ids=triggered_action_ids,
        debug_msg=debug_msg,
    )

    if options.get("workflow_engine.evaluation_logs_direct_to_sentry"):
        sentry_logger.info(log_name, attributes=extra)
    else:
        logger.info(log_name, extra=extra)
    return True
