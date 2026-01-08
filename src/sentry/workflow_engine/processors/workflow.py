from collections.abc import Sequence
from dataclasses import asdict, replace
from datetime import datetime
from enum import StrEnum
from typing import DefaultDict

import sentry_sdk
from django.db import router, transaction
from django.db.models import Q

from sentry import features
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient, DelayedWorkflowItem
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    Detector,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import DataCondition
from sentry.workflow_engine.models.workflow_data_condition_group import WorkflowDataConditionGroup
from sentry.workflow_engine.processors.contexts.workflow_event_context import (
    WorkflowEventContext,
    WorkflowEventContextData,
)
from sentry.workflow_engine.processors.data_condition_group import (
    get_data_conditions_for_group,
    process_data_condition_group,
)
from sentry.workflow_engine.processors.detector import get_detectors_for_event_data
from sentry.workflow_engine.processors.workflow_fire_history import create_workflow_fire_histories
from sentry.workflow_engine.types import (
    WorkflowEvaluation,
    WorkflowEvaluationData,
    WorkflowEventData,
)
from sentry.workflow_engine.utils import log_context, scopedstats
from sentry.workflow_engine.utils.metrics import metrics_incr

logger = log_context.get_logger(__name__)


class WorkflowDataConditionGroupType(StrEnum):
    ACTION_FILTER = "action_filter"
    WORKFLOW_TRIGGER = "workflow_trigger"


def delete_workflow(workflow: Workflow) -> bool:
    with transaction.atomic(router.db_for_write(Workflow)):
        action_filters = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )

        actions = Action.objects.filter(
            dataconditiongroupaction__condition_group__in=action_filters
        )

        # Delete the actions associated with a workflow, this is not a cascade delete
        # because we want to create a UI to maintain notification actions separately
        if actions:
            actions.delete()

        if action_filters:
            action_filters.delete()

        if workflow.when_condition_group:
            workflow.when_condition_group.delete()

        workflow.delete()

    return True


@scopedstats.timer()
def enqueue_workflows(
    client: DelayedWorkflowClient,
    items_by_workflow: dict[Workflow, DelayedWorkflowItem],
) -> None:
    items_by_project_id = DefaultDict[int, list[DelayedWorkflowItem]](list)
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
        return

    for project_id, queue_items in items_by_project_id.items():
        client.for_project(project_id).push_to_hash(
            batch_key=None,
            data={queue_item.buffer_key(): queue_item.buffer_value() for queue_item in queue_items},
        )
        items += len(queue_items)
        project_to_workflow[project_id] = sorted({item.workflow.id for item in queue_items})

    sentry_sdk.set_tag("delayed_workflow_items", items)

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


@sentry_sdk.trace
@scopedstats.timer()
def evaluate_workflow_triggers(
    workflows: set[Workflow],
    event_data: WorkflowEventData,
    event_start_time: datetime,
) -> tuple[set[Workflow], dict[Workflow, DelayedWorkflowItem]]:
    """
    Returns a tuple of (triggered_workflows, queue_items_by_workflow)
    - triggered_workflows: set of workflows that were triggered
    - queue_items_by_workflow: mapping of workflow to the delayed workflow item, used
      in the next step (evaluate action filters) to enqueue workflows with slow conditions
      within that function
    """
    triggered_workflows: set[Workflow] = set()
    queue_items_by_workflow: dict[Workflow, DelayedWorkflowItem] = {}

    dcg_ids = [
        workflow.when_condition_group_id
        for workflow in workflows
        if workflow.when_condition_group_id
    ]
    # Retrieve these as a batch to avoid a query/cache-lookup per DCG.
    data_conditions_by_dcg_id = _get_data_conditions_for_group_by_dcg(dcg_ids)

    project = event_data.event.project  # expected to be already cached
    dual_processing_logs_enabled = features.has(
        "organizations:workflow-engine-metric-alert-dual-processing-logs",
        project.organization,
    )

    for workflow in workflows:
        when_data_conditions = None
        if dcg_id := workflow.when_condition_group_id:
            when_data_conditions = data_conditions_by_dcg_id.get(dcg_id)

        evaluation, remaining_conditions = workflow.evaluate_trigger_conditions(
            event_data, when_data_conditions
        )

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
                """
                Tracking when we try to enqueue a slow condition for an activity.
                Currently, we are assuming those cases are evaluating as True since
                an activity update is meant to respond to a previous event.
                """
                metrics_incr("process_workflows.enqueue_workflow.activity")
                logger.debug(
                    "workflow_engine.process_workflows.enqueue_workflow.activity",
                    extra={
                        "event_id": event_data.event.id,
                        "workflow_id": workflow.id,
                    },
                )
        else:
            if evaluation.triggered:
                triggered_workflows.add(workflow)
                if dual_processing_logs_enabled:
                    try:
                        detector = WorkflowEventContext.get().detector
                        detector_id = detector.id if detector else None
                        logger.info(
                            "workflow_engine.process_workflows.workflow_triggered",
                            extra={
                                "workflow_id": workflow.id,
                                "detector_id": detector_id,
                                "organization_id": project.organization.id,
                                "project_id": project.id,
                                "group_type": event_data.group.type,
                            },
                        )
                    except DetectorWorkflow.DoesNotExist:
                        continue

    metrics_incr(
        "process_workflows.triggered_workflows",
        len(triggered_workflows),
    )

    # TODO - Remove `environment` access once it's in the shared logger.
    environment = WorkflowEventContext.get().environment
    if environment is None:
        try:
            environment = get_environment_by_event(event_data)
        except Environment.DoesNotExist:
            return set(), {}

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

    return triggered_workflows, queue_items_by_workflow


@sentry_sdk.trace
@scopedstats.timer()
def evaluate_workflows_action_filters(
    workflows: set[Workflow],
    event_data: WorkflowEventData,
    queue_items_by_workflow: dict[Workflow, DelayedWorkflowItem],
    event_start_time: datetime,
) -> tuple[set[DataConditionGroup], dict[Workflow, DelayedWorkflowItem]]:
    """
    Evaluate the action filters for the given workflows.
    Returns a set of DataConditionGroups that were evaluated to True.
    Enqueues workflows with slow conditions to be evaluated in a batched task.
    """
    # Collect all workflows, including those with pending slow condition results (queue_items_by_workflow)
    # to evaluate all fast conditions
    all_workflows = workflows.union(set(queue_items_by_workflow.keys()))

    action_conditions_to_workflow = {
        wdcg.condition_group: wdcg.workflow
        for wdcg in WorkflowDataConditionGroup.objects.select_related(
            "workflow", "condition_group"
        ).filter(workflow__in=all_workflows)
    }

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

    for action_condition_group, workflow in action_conditions_to_workflow.items():
        env = env_by_id.get(workflow.environment_id) if workflow.environment_id else None
        workflow_event_data = replace(event_data, workflow_env=env)
        group_evaluation, slow_conditions = process_data_condition_group(
            action_condition_group,
            workflow_event_data,
            data_conditions_by_dcg_id.get(action_condition_group.id),
        )

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
            if group_evaluation.logic_result.triggered:
                if delayed_workflow_item := queue_items_by_workflow.get(workflow):
                    if delayed_workflow_item.delayed_when_group_id:
                        # If there are already delayed when conditions,
                        # we need to evaluate them before firing the action group
                        delayed_workflow_item.passing_if_group_ids.append(action_condition_group.id)
                else:
                    filtered_action_groups.add(action_condition_group)

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
            "workflow_ids": [workflow.id for workflow in action_conditions_to_workflow.values()],
            "action_conditions": [
                action_condition_group.id
                for action_condition_group in action_conditions_to_workflow.keys()
            ],
            "filtered_action_groups": [action_group.id for action_group in filtered_action_groups],
            "queue_workflows": sorted(wf.id for wf in queue_items_by_workflow.keys()),
        },
    )

    return filtered_action_groups, queue_items_by_workflow


def get_environment_by_event(event_data: WorkflowEventData) -> Environment | None:
    if isinstance(event_data.event, GroupEvent):
        try:
            environment = event_data.event.get_environment()
        except Environment.DoesNotExist:
            metrics_incr("process_workflows.error")
            logger.exception(
                "Missing environment for event", extra={"event_id": event_data.event.event_id}
            )
            raise Environment.DoesNotExist("Environment does not exist for the event")

        return environment
    elif isinstance(event_data.event, Activity):
        return None

    raise TypeError(f"Cannot access the environment from, {type(event_data.event)}.")


@scopedstats.timer()
def _get_associated_workflows(
    detector: Detector, environment: Environment | None, event_data: WorkflowEventData
) -> set[Workflow]:
    """
    This is a wrapper method to get the workflows associated with a detector and environment.
    Used in process_workflows to wrap the query + logging into a single method
    """
    environment_filter = (
        (Q(environment_id=None) | Q(environment_id=environment.id))
        if environment
        else Q(environment_id=None)
    )
    workflows = set(
        Workflow.objects.filter(
            environment_filter,
            detectorworkflow__detector_id=detector.id,
            enabled=True,
        )
        .select_related("environment")
        .distinct()
    )

    if workflows:
        metrics_incr(
            "process_workflows",
            len(workflows),
        )

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
                "detector_type": detector.type,
            },
        )

    return workflows


@log_context.root()
def process_workflows(
    batch_client: DelayedWorkflowClient,
    event_data: WorkflowEventData,
    event_start_time: datetime,
    detector: Detector | None = None,
) -> WorkflowEvaluation:
    """
    This method will get the detector based on the event, and then gather the associated workflows.
    Next, it will evaluate the "when" (or trigger) conditions for each workflow, if the conditions are met,
    the workflow will be added to a unique list of triggered workflows.

    Finally, each of the triggered workflows will have their actions evaluated and executed.
    """
    from sentry.notifications.notification_action.utils import should_fire_workflow_actions
    from sentry.workflow_engine.processors.action import (
        filter_recently_fired_workflow_actions,
        fire_actions,
    )

    organization = event_data.event.project.organization
    workflow_evaluation_data = WorkflowEvaluationData(
        event=event_data.event, organization=organization
    )

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
        return WorkflowEvaluation(
            tainted=True,
            msg="No Detectors associated with the issue were found",
            data=workflow_evaluation_data,
        )

    workflow_evaluation_data.associated_detector = event_detectors.preferred_detector

    try:
        environment = get_environment_by_event(event_data)

        # Set the full context now that we've gotten everything.
        WorkflowEventContext.set(
            WorkflowEventContextData(
                detector=event_detectors.preferred_detector,
                environment=environment,
                organization=organization,
            )
        )
    except Environment.DoesNotExist:
        return WorkflowEvaluation(
            tainted=True,
            msg="Environment for event not found",
            data=workflow_evaluation_data,
        )

    if features.has("organizations:workflow-engine-process-workflows-logs", organization):
        log_context.set_verbose(True)

    workflows = _get_associated_workflows(
        event_detectors.preferred_detector, environment, event_data
    )
    workflow_evaluation_data.workflows = workflows

    if not workflows:
        return WorkflowEvaluation(
            tainted=True,
            msg="No workflows are associated with the detector in the event",
            data=workflow_evaluation_data,
        )

    triggered_workflows, queue_items_by_workflow_id = evaluate_workflow_triggers(
        workflows, event_data, event_start_time
    )

    workflow_evaluation_data.triggered_workflows = triggered_workflows

    if not triggered_workflows and not queue_items_by_workflow_id:
        # TODO - re-think tainted once the actions are removed from process_workflows.
        return WorkflowEvaluation(
            tainted=True,
            msg="No items were triggered or queued for slow evaluation",
            data=workflow_evaluation_data,
        )

    # TODO - we should probably return here and have the rest from here be
    # `process_actions`, this will take a list of "triggered_workflows"
    actions_to_trigger, queue_items_by_workflow_id = evaluate_workflows_action_filters(
        triggered_workflows, event_data, queue_items_by_workflow_id, event_start_time
    )

    enqueue_workflows(batch_client, queue_items_by_workflow_id)

    actions = filter_recently_fired_workflow_actions(actions_to_trigger, event_data)
    sentry_sdk.set_tag("workflow_engine.triggered_actions", len(actions))

    workflow_evaluation_data.action_groups = actions_to_trigger
    workflow_evaluation_data.triggered_actions = set(actions)
    workflow_evaluation_data.delayed_conditions = queue_items_by_workflow_id

    if not actions:
        return WorkflowEvaluation(
            tainted=True,
            msg="No actions to evaluate; filtered or not triggered",
            data=workflow_evaluation_data,
        )

    should_trigger_actions = should_fire_workflow_actions(organization, event_data.group.type)
    fire_histories = create_workflow_fire_histories(
        actions,
        event_data,
        should_trigger_actions,
        is_delayed=False,
        start_timestamp=event_start_time,
    )

    # Create mapping: workflow_id -> notification_uuid for propagation
    workflow_uuid_map: dict[int, str] = {}
    if fire_histories:
        workflow_uuid_map = {
            history.workflow_id: str(history.notification_uuid) for history in fire_histories
        }

    fire_actions(actions, event_data, workflow_uuid_map=workflow_uuid_map)

    return WorkflowEvaluation(tainted=False, data=workflow_evaluation_data)
