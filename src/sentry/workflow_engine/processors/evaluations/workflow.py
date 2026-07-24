from __future__ import annotations

import random
from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, TypedDict

from sentry_sdk import logger as sentry_logger

from sentry import features, options
from sentry.workflow_engine.types import WorkflowEvaluationResult

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
    """

    trigger_group_eval: DataConditionGroupEvaluation
    filter_group_evals: Sequence[DataConditionGroupEvaluation]


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
        sentinel when there are slow conditions to batch evaluate (whether or not
        they were enqueued).
    - `data`: WorkflowEvaluationData
    - `error`: ConditionError - Set when there's an error while evaluating the workflow.
    - `triggered`: bool - Whether the workflow's trigger (WHEN) conditions conclusively
        passed: the group evaluated to triggered with no slow conditions still pending.
    """

    log_name = "workflow"

    @classmethod
    def from_trigger(
        cls,
        *,
        trigger_eval: DataConditionGroupEvaluation,
        triggered: bool,
        result: WorkflowEvaluationResult = (),
        filter_group_evals: Sequence[DataConditionGroupEvaluation] = (),
    ) -> WorkflowEvaluation:
        """
        Build a WorkflowEvaluation from its trigger (WHEN) group evaluation, deriving
        `error` from it. `triggered` is passed explicitly because it must be the
        *conclusive* value: a partially-evaluated group can report `triggered=True`
        while slow conditions are still pending.
        """
        return cls(
            result=result,
            triggered=triggered,
            error=trigger_eval.error,
            data={
                "trigger_group_eval": trigger_eval,
                "filter_group_evals": list(filter_group_evals),
            },
        )

    def to_artifact(self) -> dict[str, Any]:
        result = self.result
        # result is either the "deferred" sentinel (a str) or the sequence of actions that fired.
        if isinstance(result, str):
            result_kind = "deferred"
            triggered_action_ids = None
        else:
            result_kind = "actions"
            triggered_action_ids = [action.id for action in result]
        return {
            "triggered": self.triggered,
            "error": self.error_message(),
            "result": result_kind,
            "triggered_action_ids": triggered_action_ids,
            "trigger_group_eval": self.data["trigger_group_eval"].to_artifact(),
            "filter_group_evals": [
                filter_eval.to_artifact() for filter_eval in self.data["filter_group_evals"]
            ],
        }


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

    The `msg` field is used for debug information during the evaluation.

    The batch-level facts about the evaluation — which workflows triggered, which
    actions fired, and whether the run is `tainted` — are derived from the
    per-workflow evaluations in `result` rather than stored.
    """

    # Per-workflow evaluations, keyed by workflow id. Empty for sentinel early-returns.
    result: dict[WorkflowId, WorkflowEvaluation]

    # Batch-level context used by to_log / to_artifact / get_snapshot / consumers.
    organization: Organization
    event: GroupEvent | Activity
    msg: str | None = None
    associated_detector: Detector | None = None
    workflows: set[Workflow] | None = None
    action_groups: set[DataConditionGroup] | None = None
    delayed_conditions: dict[Workflow, DelayedWorkflowItem] | None = None

    @property
    def triggered_workflows(self) -> set[Workflow]:
        """The workflows whose trigger (WHEN) conditions conclusively passed."""
        if not self.workflows:
            return set()
        return {
            workflow
            for workflow in self.workflows
            if (evaluation := self.result.get(workflow.id)) and evaluation.triggered
        }

    @property
    def triggered_actions(self) -> set[Action]:
        """All actions that fired across the evaluated workflows."""
        return {
            action
            for evaluation in self.result.values()
            if evaluation.result != "deferred"
            for action in evaluation.result
        }

    @property
    def tainted(self) -> bool:
        """True until actions actually fired for this batch (i.e. for every early exit)."""
        return not self.triggered_actions

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

    def to_artifact(self) -> dict[str, Any]:
        """
        Flatten the batch-level context into a structured, log-safe dict (ids, counts, and
        debug info) and embed each workflow's own `to_artifact()` under `workflow_evaluations`
        so a log search can answer *why* a given workflow did or didn't trigger.

        This is the `extra` payload emitted by `to_log`. Empty per-workflow evaluations for the
        sentinel early-return paths, where `result` is `{}`.
        """
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
        return {
            "event_id": data_snapshot["event_id"],
            "group_id": group_id,
            "detection_type": detection_type,
            "workflow_ids": data_snapshot["workflow_ids"],
            "triggered_workflow_ids": [w["id"] for w in triggered_workflows],
            "delayed_conditions": data_snapshot["delayed_conditions"],
            "action_filter_group_ids": [afg["id"] for afg in action_filter_conditions],
            "triggered_action_ids": [a["id"] for a in triggered_actions],
            "debug_msg": self.msg,
            "workflow_evaluations": {
                str(workflow_id): evaluation.to_artifact()
                for workflow_id, evaluation in self.result.items()
            },
        }

    def to_log(self, logger: Logger) -> bool:
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

        extra = self.to_artifact()

        if direct_to_sentry:
            sentry_logger.info(log_str, attributes=extra)
        else:
            logger.info(log_str, extra=extra)
        return True
