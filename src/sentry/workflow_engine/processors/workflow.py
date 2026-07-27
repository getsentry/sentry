from collections import defaultdict
from collections.abc import Collection, Iterable, Sequence
from dataclasses import asdict, dataclass, replace
from datetime import datetime
from enum import StrEnum

import sentry_sdk
from django.db.models import Q

from sentry import features, options
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.services.eventstore.models import GroupEvent
from sentry.utils.tracing import trace
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient, DelayedWorkflowItem
from sentry.workflow_engine.caches.action_filters import get_action_filters_by_workflows
from sentry.workflow_engine.caches.workflow import get_workflows_by_detectors
from sentry.workflow_engine.models import Action, DataConditionGroup, Detector, Workflow
from sentry.workflow_engine.models.data_condition import DataCondition
from sentry.workflow_engine.processors.contexts.workflow_event_context import (
    WorkflowEventContext,
    WorkflowEventContextData,
)
from sentry.workflow_engine.processors.data_condition_group import (
    get_data_conditions_for_group,
    process_data_condition_group,
)
from sentry.workflow_engine.processors.detector import get_detectors_for_event_data
from sentry.workflow_engine.processors.evaluations import (
    DataConditionGroupEvaluation,
    TriggerResult,
)
from sentry.workflow_engine.processors.evaluations.workflow import (
    GroupedWorkflowEvaluationResult,
    WorkflowEvaluation,
)
from sentry.workflow_engine.processors.workflow_fire_history import create_workflow_fire_histories
from sentry.workflow_engine.types import (
    WorkflowEvaluationResult,
    WorkflowEventData,
    WorkflowId,
)
from sentry.workflow_engine.utils import log_context, scopedstats
from sentry.workflow_engine.utils.metrics import metrics_incr

logger = log_context.get_logger(__name__)


class WorkflowDataConditionGroupType(StrEnum):
    ACTION_FILTER = "action_filter"
    WORKFLOW_TRIGGER = "workflow_trigger"


@dataclass(frozen=True)
class EvaluationStats:
    """
    Counts of fully-evaluated workflows by result reliability.
    Tainted results may be incorrect due to errors during evaluation.
    """

    tainted: int = 0
    untainted: int = 0

    @classmethod
    def from_results(cls, results: Iterable[TriggerResult]) -> "EvaluationStats":
        tainted, untainted = 0, 0
        for result in results:
            if result.is_tainted():
                tainted += 1
            else:
                untainted += 1
        return cls(tainted=tainted, untainted=untainted)

    def __add__(self, other: "EvaluationStats") -> "EvaluationStats":
        return EvaluationStats(
            tainted=self.tainted + other.tainted,
            untainted=self.untainted + other.untainted,
        )

    def report_metrics(self, metric_name: str) -> None:
        metrics_incr(metric_name, self.tainted, tags={"tainted": True})
        metrics_incr(metric_name, self.untainted, tags={"tainted": False})


@scopedstats.timer()
def enqueue_workflows(
    client: DelayedWorkflowClient,
    items_by_workflow: dict[Workflow, DelayedWorkflowItem],
) -> None:
    items_by_project_id = defaultdict[int, list[DelayedWorkflowItem]](list)
    for queue_item in items_by_workflow.values():
        if not queue_item.delayed_if_group_ids and not queue_item.passing_if_group_ids:
            # Skip because there are no IF groups we could possibly fire actions for if
            # the WHEN/IF delayed conditions are met
            continue
        project_id = queue_item.event.project_id
        items_by_project_id[project_id].append(queue_item)

    items = 0
    project_to_workflow: dict[int, list[int]] = {}
    if not items_by_project_id:
        sentry_sdk.set_tag("delayed_workflow_items", items)
        sentry_sdk.set_attribute("delayed_workflow_items", items)
        return

    for project_id, queue_items in items_by_project_id.items():
        client.for_project(project_id).push_to_hash(
            batch_key=None,
            data={queue_item.buffer_key(): queue_item.buffer_value() for queue_item in queue_items},
        )
        items += len(queue_items)
        project_to_workflow[project_id] = sorted({item.workflow.id for item in queue_items})

    sentry_sdk.set_tag("delayed_workflow_items", items)
    sentry_sdk.set_attribute("delayed_workflow_items", items)

    client.add_project_ids(list(items_by_project_id.keys()))

    logger.debug(
        "workflow_engine.workflows.enqueued",
        extra={
            "project_to_workflow": project_to_workflow,
        },
    )


@scopedstats.timer()
def _get_data_conditions_for_group_by_dcg(dcg_ids: Sequence[int]) -> dict[int, list[DataCondition]]:
    """
    Given a list of DataConditionGroup IDs, return a dict mapping them to their DataConditions.
    Fetching them individually as needed is typically simple; this is for cases where the performance
    benefit is worth passing around a dict.
    """
    if not dcg_ids:
        return {}
    # `batch` wants param tuples and associates return results by index.
    return dict(
        zip(dcg_ids, get_data_conditions_for_group.batch([(dcg_id,) for dcg_id in dcg_ids]))
    )


@trace
@scopedstats.timer()
def evaluate_workflow_triggers(
    workflows: set[Workflow],
    event_data: WorkflowEventData,
    event_start_time: datetime,
) -> tuple[
    dict[Workflow, TriggerResult],
    dict[Workflow, DelayedWorkflowItem],
    EvaluationStats,
    dict[Workflow, DataConditionGroupEvaluation],
]:
    """
    Returns a tuple of (triggered_workflows, queue_items_by_workflow, stats, trigger_evals)
    - triggered_workflows: mapping of workflows that triggered to their evaluation result
    - queue_items_by_workflow: mapping of workflow to the delayed workflow item, used
      in the next step (evaluate action filters) to enqueue workflows with slow conditions
      within that function
    - stats: tainted/untainted counts for workflows that didn't trigger (fully evaluated)
    - trigger_evals: the trigger (WHEN) group evaluation for every evaluated workflow,
      including those enqueued for slow evaluation
    """
    triggered_workflows: dict[Workflow, TriggerResult] = {}
    queue_items_by_workflow: dict[Workflow, DelayedWorkflowItem] = {}
    trigger_evals: dict[Workflow, DataConditionGroupEvaluation] = {}

    dcg_ids = [
        workflow.when_condition_group_id
        for workflow in workflows
        if workflow.when_condition_group_id
    ]
    # Retrieve these as a batch to avoid a query/cache-lookup per DCG.
    data_conditions_by_dcg_id = _get_data_conditions_for_group_by_dcg(dcg_ids)

    # Retrieve data condition groups as a batch to avoid a query/cache-lookup per DCG.
    data_condition_groups_by_id: dict[int, DataConditionGroup] = {
        dcg.id: dcg for dcg in DataConditionGroup.objects.get_many_from_cache(dcg_ids)
    }

    tainted_untriggered, untainted_untriggered = 0, 0
    for workflow in workflows:
        when_data_conditions = None
        when_condition_group = None
        if dcg_id := workflow.when_condition_group_id:
            when_data_conditions = data_conditions_by_dcg_id.get(dcg_id)
            when_condition_group = data_condition_groups_by_id.get(dcg_id)

        evaluation, remaining_conditions = workflow.evaluate_trigger_conditions(
            event_data, when_data_conditions, when_condition_group
        )
        trigger_evals[workflow] = evaluation

        if remaining_conditions:
            if isinstance(event_data.event, GroupEvent):
                queue_items_by_workflow[workflow] = DelayedWorkflowItem(
                    workflow=workflow,
                    event=event_data.event,
                    delayed_when_group_id=workflow.when_condition_group_id,
                    delayed_if_group_ids=[],
                    passing_if_group_ids=[],
                    timestamp=event_start_time,
                )
            else:
                # Activity updates with slow conditions are not enqueued because an activity
                # update is meant to respond to a previous event.
                metrics_incr("process_workflows.enqueue_workflow.activity")
                logger.debug(
                    "workflow_engine.process_workflows.enqueue_workflow.activity",
                    extra={
                        "event_id": event_data.event.id,
                        "workflow_id": workflow.id,
                    },
                )
        else:
            if evaluation.outcome.triggered:
                triggered_workflows[workflow] = evaluation.outcome
            else:
                if evaluation.outcome.is_tainted():
                    tainted_untriggered += 1
                else:
                    untainted_untriggered += 1

    stats = EvaluationStats(tainted=tainted_untriggered, untainted=untainted_untriggered)
    metrics_incr("process_workflows.triggered_workflows", len(triggered_workflows))

    # TODO - Remove `environment` access once it's in the shared logger.
    environment = WorkflowEventContext.get().environment
    if environment is None:
        try:
            environment = get_environment_by_event(event_data)
        except Environment.DoesNotExist:
            return {}, {}, stats, {}

    event_id = (
        event_data.event.event_id
        if isinstance(event_data.event, GroupEvent)
        else event_data.event.id
    )
    logger.debug(
        "workflow_engine.process_workflows.triggered_workflows",
        extra={
            "group_id": event_data.group.id,
            "event_id": event_id,
            "event_data": asdict(event_data),
            "event_environment_id": environment.id if environment else None,
            "triggered_workflows": [workflow.id for workflow in triggered_workflows],
            "queue_workflows": sorted(wf.id for wf in queue_items_by_workflow.keys()),
        },
    )

    return triggered_workflows, queue_items_by_workflow, stats, trigger_evals


@trace
@scopedstats.timer()
def evaluate_workflows_action_filters(
    triggered_workflows: dict[Workflow, TriggerResult],
    event_data: WorkflowEventData,
    queue_items_by_workflow: dict[Workflow, DelayedWorkflowItem],
    event_start_time: datetime,
) -> tuple[
    set[DataConditionGroup],
    dict[Workflow, DelayedWorkflowItem],
    EvaluationStats,
    dict[Workflow, list[DataConditionGroupEvaluation]],
]:
    """
    Evaluate the action filters for the given workflows.
    Returns a tuple of (filtered_action_groups, queue_items_by_workflow, stats, filter_evals)
    - filtered_action_groups: set of DataConditionGroups that were evaluated to True
    - queue_items_by_workflow: updated with workflows that have slow conditions
    - stats: tainted/untainted counts for fully-evaluated workflows
    - filter_evals: the action-filter (IF) group evaluations per workflow
    """
    # Collect all workflows, including those with pending slow condition results (queue_items_by_workflow)
    # to evaluate all fast conditions
    all_workflows: set[Workflow] = set(triggered_workflows.keys()) | set(
        queue_items_by_workflow.keys()
    )

    action_conditions_to_workflow: dict[DataConditionGroup, Workflow] = {}
    all_workflows_lookup: dict[int, Workflow] = {w.id: w for w in all_workflows}
    action_filters_by_workflows = get_action_filters_by_workflows(all_workflows)

    for workflow_id, dcgs in action_filters_by_workflows.items():
        for dcg in dcgs:
            action_conditions_to_workflow[dcg] = all_workflows_lookup[workflow_id]

    filtered_action_groups: set[DataConditionGroup] = set()

    # Retrieve these as a batch to avoid a query/cache-lookup per DCG.
    data_conditions_by_dcg_id = _get_data_conditions_for_group_by_dcg(
        [dcg.id for dcg in action_conditions_to_workflow.keys()]
    )

    env_by_id: dict[int, Environment] = {
        env.id: env
        for env in Environment.objects.get_many_from_cache(
            {
                wf.environment_id
                for wf in action_conditions_to_workflow.values()
                if wf.environment_id
            }
        )
    }

    workflow_to_result: dict[int, TriggerResult] = {
        wf.id: result for wf, result in triggered_workflows.items()
    }
    filter_evals_by_workflow: dict[Workflow, list[DataConditionGroupEvaluation]] = defaultdict(list)
    for action_condition_group, workflow in action_conditions_to_workflow.items():
        env = env_by_id.get(workflow.environment_id) if workflow.environment_id else None
        workflow_event_data = replace(event_data, workflow_env=env)
        group_evaluation, slow_conditions = process_data_condition_group(
            action_condition_group,
            workflow_event_data,
            data_conditions_by_dcg_id.get(action_condition_group.id),
        )
        filter_evals_by_workflow[workflow].append(group_evaluation)

        if slow_conditions:
            # If there are remaining conditions for the action filter to evaluate,
            # then return the list of conditions to enqueue.

            if isinstance(event_data.event, GroupEvent):
                if delayed_workflow_item := queue_items_by_workflow.get(workflow):
                    delayed_workflow_item.delayed_if_group_ids.append(action_condition_group.id)
                else:
                    queue_items_by_workflow[workflow] = DelayedWorkflowItem(
                        workflow=workflow,
                        delayed_when_group_id=None,
                        delayed_if_group_ids=[action_condition_group.id],
                        event=event_data.event,
                        passing_if_group_ids=[],
                        timestamp=event_start_time,
                    )
            else:
                # We should not include activity updates in delayed conditions,
                # this is because the actions should always be triggered if this condition is met.
                # The original snuba queries would have to be over threshold to create this event
                metrics_incr("process_workflows.enqueue_workflow.activity")
                logger.debug(
                    "workflow_engine.process_workflows.enqueue_workflow.activity",
                    extra={
                        "event_id": event_data.event.id,
                        "action_condition_id": action_condition_group.id,
                        "workflow_id": workflow.id,
                    },
                )
        else:
            # Only accumulate taint for triggered workflows (not those with slow WHEN conditions)
            if workflow.id in workflow_to_result:
                workflow_to_result[workflow.id] = TriggerResult.choose_tainted(
                    workflow_to_result[workflow.id],
                    group_evaluation.outcome,
                )

            if group_evaluation.outcome.triggered:
                if delayed_workflow_item := queue_items_by_workflow.get(workflow):
                    if delayed_workflow_item.delayed_when_group_id:
                        # If there are already delayed when conditions,
                        # we need to evaluate them before firing the action group
                        delayed_workflow_item.passing_if_group_ids.append(action_condition_group.id)
                else:
                    filtered_action_groups.add(action_condition_group)

    # Count tainted/untainted only for fully-evaluated workflows (not delayed)
    fully_evaluated_workflows = triggered_workflows.keys() - queue_items_by_workflow.keys()
    stats = EvaluationStats.from_results(
        workflow_to_result[wf.id] for wf in fully_evaluated_workflows
    )

    event_id = (
        event_data.event.event_id
        if isinstance(event_data.event, GroupEvent)
        else event_data.event.id
    )

    logger.debug(
        "workflow_engine.evaluate_workflows_action_filters",
        extra={
            "group_id": event_data.group.id,
            "event_id": event_id,
            "workflow_ids": [wf.id for wf in action_conditions_to_workflow.values()],
            "action_conditions": [
                action_condition_group.id
                for action_condition_group in action_conditions_to_workflow.keys()
            ],
            "filtered_action_groups": [action_group.id for action_group in filtered_action_groups],
            "queue_workflows": sorted(wf.id for wf in queue_items_by_workflow.keys()),
        },
    )

    return filtered_action_groups, queue_items_by_workflow, stats, filter_evals_by_workflow


def get_environment_by_event(event_data: WorkflowEventData) -> Environment | None:
    if isinstance(event_data.event, GroupEvent):
        try:
            environment = event_data.event.get_environment()
        except Environment.DoesNotExist:
            logger.info(
                "workflow_engine.process_workflows.environment_not_found",
                extra={"event_id": event_data.event.event_id},
            )
            raise Environment.DoesNotExist("Environment does not exist for the event")

        return environment
    elif isinstance(event_data.event, Activity):
        return None

    raise TypeError(f"Cannot access the environment from, {type(event_data.event)}.")


def _get_associated_workflows(
    detectors: Collection[Detector], environment: Environment | None
) -> set[Workflow]:
    """
    Get workflows associated with detectors and environment via direct DB query.
    Used as fallback when cache is disabled via feature flag.
    """
    detector_ids = [detector.id for detector in detectors]

    environment_filter = (
        (Q(environment_id=None) | Q(environment_id=environment.id))
        if environment
        else Q(environment_id=None)
    )
    return set(
        Workflow.objects.filter(
            environment_filter,
            detectorworkflow__detector_id__in=detector_ids,
            enabled=True,
        )
        .select_related("environment")
        .distinct()
    )


def _build_workflow_evaluations(
    *,
    event_data: WorkflowEventData,
    trigger_evals: dict[Workflow, DataConditionGroupEvaluation],
    filter_evals: dict[Workflow, list[DataConditionGroupEvaluation]],
    deferred_workflow_ids: set[WorkflowId],
    actions: Iterable[Action],
    action_to_workflow_id: dict[int, WorkflowId],
) -> dict[WorkflowId, WorkflowEvaluation]:
    """
    Build a per-workflow WorkflowEvaluation for every evaluated workflow, capturing its
    trigger (WHEN) evaluation, action-filter (IF) evaluations, and resulting actions.

    `result` is the "deferred" sentinel for workflows enqueued for slow evaluation, otherwise
    the actions that fired for that workflow (empty when the workflow triggered but no actions
    fired). `action_to_workflow_id` attributes each action to a single workflow, so an action
    shared across workflows is counted once here; the batch-level triggered_actions holds the
    complete set.
    """
    actions_by_workflow_id: dict[WorkflowId, list[Action]] = defaultdict(list)
    for action in actions:
        if (workflow_id := action_to_workflow_id.get(action.id)) is not None:
            actions_by_workflow_id[workflow_id].append(action)

    workflow_evaluations: dict[WorkflowId, WorkflowEvaluation] = {}
    for workflow, trigger_eval in trigger_evals.items():
        result: WorkflowEvaluationResult = (
            "deferred"
            if workflow.id in deferred_workflow_ids
            else actions_by_workflow_id.get(workflow.id, [])
        )
        workflow_evaluations[workflow.id] = WorkflowEvaluation(
            result=result,
            triggered=trigger_eval.outcome.triggered,
            error=trigger_eval.outcome.error,
            data={
                "trigger_group_eval": trigger_eval,
                "filter_group_evals": filter_evals.get(workflow, []),
                "event": event_data,
            },
        )
    return workflow_evaluations


@log_context.root()
def process_workflows(
    batch_client: DelayedWorkflowClient,
    event_data: WorkflowEventData,
    event_start_time: datetime,
    detector: Detector | None = None,
) -> GroupedWorkflowEvaluationResult:
    """
    This method will get the detector based on the event, and then gather the associated workflows.
    Next, it will evaluate the "when" (or trigger) conditions for each workflow, if the conditions are met,
    the workflow will be added to a unique list of triggered workflows.

    Finally, each of the triggered workflows will have their actions evaluated and executed.
    """
    from sentry.workflow_engine.processors.action import (
        filter_recently_fired_workflow_actions,
        fire_actions,
    )

    organization = event_data.event.project.organization

    try:
        event_detectors = get_detectors_for_event_data(event_data, detector)

        if not event_detectors:
            raise Detector.DoesNotExist("No Detectors associated with the issue were found")

        log_context.add_extras(
            detector_id=event_detectors.preferred_detector.id, group_id=event_data.group.id
        )

        # set the detector / org information asap, this is used in `get_environment_by_event` as well.
        WorkflowEventContext.set(
            WorkflowEventContextData(
                detector=event_detectors.preferred_detector,
                organization=organization,
            )
        )
    except Detector.DoesNotExist:
        return GroupedWorkflowEvaluationResult(
            result={},
            tainted=True,
            organization=organization,
            event=event_data.event,
            group=event_data.group,
            msg="No Detectors associated with the issue were found",
        )

    associated_detector = event_detectors.preferred_detector

    try:
        environment = get_environment_by_event(event_data)

        # Set the full context now that we've gotten everything.
        WorkflowEventContext.set(
            WorkflowEventContextData(
                detector=associated_detector,
                environment=environment,
                organization=organization,
            )
        )
    except Environment.DoesNotExist:
        return GroupedWorkflowEvaluationResult(
            result={},
            tainted=True,
            organization=organization,
            event=event_data.event,
            group=event_data.group,
            msg="Environment for event not found",
            associated_detector=associated_detector,
        )

    if features.has("organizations:workflow-engine-process-workflows-logs", organization):
        log_context.set_verbose(True)

    workflows = get_workflows_by_detectors(event_detectors.detectors, environment)
    wrong_org_workflows = {wf for wf in workflows if wf.organization_id != organization.id}
    if wrong_org_workflows:
        logger.warning(
            "workflow_engine.process_workflows.wrong_organization",
            extra={
                "organization_id": organization.id,
                "wrong_org_workflow_ids": sorted(wf.id for wf in wrong_org_workflows),
                "wrong_org_organization_ids": sorted(
                    wf.organization_id for wf in wrong_org_workflows
                ),
            },
        )
        if options.get("workflow_engine.filter_cross_org_workflows"):
            workflows = workflows - wrong_org_workflows

    if workflows:
        metrics_incr("process_workflows", len(workflows))

        event_id = (
            event_data.event.event_id
            if isinstance(event_data.event, GroupEvent)
            else event_data.event.id
        )
        logger.debug(
            "workflow_engine.process_workflows",
            extra={
                "payload": event_data,
                "group_id": event_data.group.id,
                "event_id": event_id,
                "event_data": asdict(event_data),
                "event_environment_id": environment.id if environment else None,
                "workflows": [workflow.id for workflow in workflows],
                "detector_types": [d.type for d in event_detectors.detectors],
            },
        )

    if not workflows:
        return GroupedWorkflowEvaluationResult(
            result={},
            tainted=True,
            organization=organization,
            event=event_data.event,
            group=event_data.group,
            msg="No workflows are associated with the detector in the event",
            associated_detector=associated_detector,
            workflows=workflows,
        )

    triggered_workflows, queue_items_by_workflow_id, trigger_stats, trigger_evals = (
        evaluate_workflow_triggers(workflows, event_data, event_start_time)
    )

    triggered_workflow_set = set(triggered_workflows.keys())

    if not triggered_workflows and not queue_items_by_workflow_id:
        trigger_stats.report_metrics("process_workflows.workflows_evaluated")
        # TODO - re-think tainted once the actions are removed from process_workflows.
        return GroupedWorkflowEvaluationResult(
            result={},
            tainted=True,
            organization=organization,
            event=event_data.event,
            group=event_data.group,
            msg="No items were triggered or queued for slow evaluation",
            associated_detector=associated_detector,
            workflows=workflows,
            triggered_workflows=triggered_workflow_set,
        )

    # TODO - we should probably return here and have the rest from here be
    # `process_actions`, this will take a list of "triggered_workflows"
    actions_to_trigger, queue_items_by_workflow_id, action_stats, filter_evals = (
        evaluate_workflows_action_filters(
            triggered_workflows, event_data, queue_items_by_workflow_id, event_start_time
        )
    )
    (trigger_stats + action_stats).report_metrics("process_workflows.workflows_evaluated")

    enqueue_workflows(batch_client, queue_items_by_workflow_id)

    actions, action_to_workflow_id = filter_recently_fired_workflow_actions(
        actions_to_trigger, event_data
    )

    workflow_evaluations = _build_workflow_evaluations(
        event_data=event_data,
        trigger_evals=trigger_evals,
        filter_evals=filter_evals,
        deferred_workflow_ids={wf.id for wf in queue_items_by_workflow_id},
        actions=actions,
        action_to_workflow_id=action_to_workflow_id,
    )

    triggered_actions = set(actions)
    sentry_sdk.set_tag("workflow_engine.triggered_actions", len(triggered_actions))
    sentry_sdk.set_attribute("workflow_engine.triggered_actions", len(triggered_actions))

    if not actions:
        return GroupedWorkflowEvaluationResult(
            result=workflow_evaluations,
            tainted=True,
            organization=organization,
            event=event_data.event,
            group=event_data.group,
            msg="No actions to evaluate; filtered or not triggered",
            associated_detector=associated_detector,
            workflows=workflows,
            triggered_workflows=triggered_workflow_set,
            action_groups=actions_to_trigger,
            triggered_actions=triggered_actions,
            delayed_conditions=queue_items_by_workflow_id,
        )

    fire_histories = create_workflow_fire_histories(
        actions,
        event_data,
        is_delayed=False,
        start_timestamp=event_start_time,
    )

    # Create mapping: workflow_id -> notification_uuid for propagation
    workflow_uuid_map: dict[WorkflowId, str] = {}
    if fire_histories:
        workflow_uuid_map = {
            history.workflow_id: str(history.notification_uuid) for history in fire_histories
        }

    fire_actions(
        actions,
        event_data,
        workflow_uuid_map=workflow_uuid_map,
        action_to_workflow_id=action_to_workflow_id,
    )

    return GroupedWorkflowEvaluationResult(
        result=workflow_evaluations,
        tainted=False,
        organization=organization,
        event=event_data.event,
        group=event_data.group,
        associated_detector=associated_detector,
        workflows=workflows,
        triggered_workflows=triggered_workflow_set,
        action_groups=actions_to_trigger,
        triggered_actions=triggered_actions,
        delayed_conditions=queue_items_by_workflow_id,
    )
