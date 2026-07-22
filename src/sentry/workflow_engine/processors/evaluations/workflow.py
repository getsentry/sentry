from __future__ import annotations

import random
from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypedDict

from sentry_sdk import logger as sentry_logger

from sentry import features, options
from sentry.workflow_engine.types import WorkflowEvaluationResult, WorkflowEventData

from .base import BaseWorkflowEngineEvaluation
from .condition_group import DataConditionGroupEvaluation

if TYPE_CHECKING:
    from logging import Logger

    from sentry.models.activity import Activity
    from sentry.models.group import Group
    from sentry.models.organization import Organization
    from sentry.services.eventstore.models import GroupEvent
    from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowItem
    from sentry.workflow_engine.models import Action, DataConditionGroup, Detector, Workflow
    from sentry.workflow_engine.models.action import ActionSnapshot
    from sentry.workflow_engine.models.data_condition_group import DataConditionGroupSnapshot
    from sentry.workflow_engine.models.detector import DetectorSnapshot
    from sentry.workflow_engine.models.workflow import WorkflowSnapshot
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

    pass


class WorkflowEvaluationSnapshot(TypedDict):
    """
    A snapshot of data used to evaluate workflows for an event.
    Ensure that this size is kept smaller, since it's used in logging.
    """

    associated_detector: DetectorSnapshot | None
    event_id: str | None  # ID in NodeStore
    group: Group | None
    workflow_ids: list[int] | None
    triggered_workflows: list[WorkflowSnapshot] | None
    delayed_conditions: list[str] | None
    action_filter_conditions: list[DataConditionGroupSnapshot] | None
    triggered_actions: list[ActionSnapshot] | None


@dataclass(frozen=True, kw_only=True)
class GroupedWorkflowEvaluationResult:
    """
    The result of `process_workflows` for a single event: the per-workflow
    `WorkflowEvaluation` objects plus the batch-level context needed for logging
    and to drive downstream side effects (service hooks).

    Mirrors `GroupedDetectorEvaluationResult` from the detector path.

    The `tainted` flag indicates whether actions have been triggered during the
    workflows evaluation (`False` only once actions fire, `True` for every early exit).

    The `msg` field is used for debug information during the evaluation.
    """

    # Per-workflow evaluations, keyed by workflow id. Empty for sentinel early-returns.
    result: dict[WorkflowId, WorkflowEvaluation]
    tainted: bool

    # Batch-level context used by log_to / get_snapshot / consumers.
    organization: Organization
    event: GroupEvent | Activity
    group: Group | None = None
    msg: str | None = None
    associated_detector: Detector | None = None
    workflows: set[Workflow] | None = None
    triggered_workflows: set[Workflow] | None = None
    action_groups: set[DataConditionGroup] | None = None
    triggered_actions: set[Action] | None = None
    delayed_conditions: dict[Workflow, DelayedWorkflowItem] | None = None

    def get_snapshot(self) -> WorkflowEvaluationSnapshot:
        """
        This method will take the complex data structures, like models / list of models,
        and turn them into the critical attributes of a model or lists of IDs.
        """

        associated_detector = None
        if self.associated_detector:
            associated_detector = self.associated_detector.get_snapshot()

        workflow_ids = None
        if self.workflows:
            workflow_ids = [workflow.id for workflow in self.workflows]

        triggered_workflows = None
        if self.triggered_workflows:
            triggered_workflows = [workflow.get_snapshot() for workflow in self.triggered_workflows]

        action_filter_conditions = None
        if self.action_groups:
            action_filter_conditions = [group.get_snapshot() for group in self.action_groups]

        triggered_actions = None
        if self.triggered_actions:
            triggered_actions = [action.get_snapshot() for action in self.triggered_actions]

        event_id = None
        if hasattr(self.event, "event_id"):
            event_id = str(self.event.event_id)

        delayed_conditions = None
        if self.delayed_conditions:
            delayed_conditions = [
                delayed_item.buffer_key() for _, delayed_item in self.delayed_conditions.items()
            ]

        return {
            "associated_detector": associated_detector,
            "event_id": event_id,
            "group": self.event.group,
            "workflow_ids": workflow_ids,
            "triggered_workflows": triggered_workflows,
            "delayed_conditions": delayed_conditions,
            "action_filter_conditions": action_filter_conditions,
            "triggered_actions": triggered_actions,
        }

    def log_to(self, logger: Logger) -> bool:
        """
        Logs workflow evaluation data.
        Logging may be skipped if the organization isn't opted in and logs are being
        sampled.
        Returns True if logged, False otherwise.
        """
        # Check if we should log this evaluation
        organization = self.organization
        should_log = features.has("organizations:workflow-engine-log-evaluations", organization)
        direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")

        if not should_log:
            sample_rate = options.get("workflow_engine.evaluation_log_sample_rate")
            should_log = random.random() < sample_rate

        if not should_log:
            return False

        log_str = "workflow_engine.process_workflows.evaluation"

        if self.tainted:
            if not self.triggered_workflows:
                log_str = f"{log_str}.workflows.not_triggered"
            else:
                log_str = f"{log_str}.workflows.triggered"
        else:
            log_str = f"{log_str}.actions.triggered"

        data_snapshot = self.get_snapshot()
        detection_type = (
            data_snapshot["associated_detector"]["type"]
            if data_snapshot["associated_detector"]
            else None
        )
        group_id = data_snapshot["group"].id if data_snapshot["group"] else None
        triggered_workflows = data_snapshot["triggered_workflows"] or []
        action_filter_conditions = data_snapshot["action_filter_conditions"] or []
        triggered_actions = data_snapshot["triggered_actions"] or []
        extra = {
            "event_id": data_snapshot["event_id"],
            "group_id": group_id,
            "detection_type": detection_type,
            "workflow_ids": data_snapshot["workflow_ids"],
            "triggered_workflow_ids": [w["id"] for w in triggered_workflows],
            "delayed_conditions": data_snapshot["delayed_conditions"],
            "action_filter_group_ids": [afg["id"] for afg in action_filter_conditions],
            "triggered_action_ids": [a["id"] for a in triggered_actions],
            "debug_msg": self.msg,
        }

        if direct_to_sentry:
            sentry_logger.info(log_str, attributes=extra)
        else:
            logger.info(log_str, extra=extra)
        return True
