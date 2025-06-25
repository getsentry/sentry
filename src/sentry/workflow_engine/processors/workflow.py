from collections.abc import Collection, Mapping
from dataclasses import asdict, dataclass, replace
from datetime import datetime
from enum import StrEnum
from typing import DefaultDict

import sentry_sdk
from django.db import router, transaction
from django.db.models import F, Q
from django.utils import timezone

from sentry import buffer, features
from sentry.eventstore.models import GroupEvent
from sentry.models.environment import Environment
from sentry.utils import json
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
)
from sentry.workflow_engine.processors.action import filter_recently_fired_workflow_actions
from sentry.workflow_engine.processors.contexts.workflow_event_context import (
    WorkflowEventContext,
    WorkflowEventContextData,
)
from sentry.workflow_engine.processors.data_condition_group import process_data_condition_group
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.processors.workflow_fire_history import create_workflow_fire_histories
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils import log_context
from sentry.workflow_engine.utils.metrics import metrics_incr

logger = log_context.get_logger(__name__)

WORKFLOW_ENGINE_BUFFER_LIST_KEY = "workflow_engine_delayed_processing_buffer"


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


@dataclass(frozen=True)
class DelayedWorkflowItem:
    workflow: Workflow
    delayed_conditions: list[DataCondition]
    event: GroupEvent
    source: WorkflowDataConditionGroupType

    # Used to pick the end of the time window in snuba querying.
    # Should be close to when fast conditions were evaluated to try to be consistent.
    timestamp: datetime

    def buffer_key(self) -> str:
        condition_group_set = {
            condition.condition_group_id for condition in self.delayed_conditions
        }
        condition_groups = ",".join(
            str(condition_group_id) for condition_group_id in sorted(condition_group_set)
        )
        return f"{self.workflow.id}:{self.event.group.id}:{condition_groups}:{self.source}"

    def buffer_value(self) -> str:
        return json.dumps(
            {
                "event_id": self.event.event_id,
                "occurrence_id": self.event.occurrence_id,
                "timestamp": self.timestamp,
            }
        )


def enqueue_workflows(
    items_by_project_id: Mapping[int, Collection[DelayedWorkflowItem]],
) -> None:
    if not items_by_project_id:
        return
    for project_id, queue_items in items_by_project_id.items():
        buffer.backend.push_to_hash_bulk(
            model=Workflow,
            filters={"project_id": project_id},
            data={queue_item.buffer_key(): queue_item.buffer_value() for queue_item in queue_items},
        )

    buffer.backend.push_to_sorted_set(
        key=WORKFLOW_ENGINE_BUFFER_LIST_KEY, value=list(items_by_project_id.keys())
    )


@sentry_sdk.trace
def evaluate_workflow_triggers(
    workflows: set[Workflow], event_data: WorkflowEventData
) -> set[Workflow]:
    triggered_workflows: set[Workflow] = set()
    queue_items_by_project_id = DefaultDict[int, list[DelayedWorkflowItem]](list)
    current_time = timezone.now()

    for workflow in workflows:
        evaluation, remaining_conditions = workflow.evaluate_trigger_conditions(event_data)

        if remaining_conditions:
            queue_items_by_project_id[event_data.event.group.project_id].append(
                DelayedWorkflowItem(
                    workflow,
                    remaining_conditions,
                    event_data.event,
                    WorkflowDataConditionGroupType.WORKFLOW_TRIGGER,
                    timestamp=current_time,
                )
            )
        else:
            if evaluation:
                triggered_workflows.add(workflow)

    enqueue_workflows(queue_items_by_project_id)

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
            return set()

    logger.info(
        "workflow_engine.process_workflows.triggered_workflows",
        extra={
            "group_id": event_data.event.group_id,
            "event_id": event_data.event.event_id,
            "event_data": asdict(event_data),
            "event_environment_id": environment.id,
            "triggered_workflows": [workflow.id for workflow in triggered_workflows],
        },
    )

    return triggered_workflows


@sentry_sdk.trace
def evaluate_workflows_action_filters(
    workflows: set[Workflow],
    event_data: WorkflowEventData,
) -> set[DataConditionGroup]:
    filtered_action_groups: set[DataConditionGroup] = set()
    action_conditions = (
        DataConditionGroup.objects.filter(workflowdataconditiongroup__workflow__in=workflows)
        .annotate(workflow_id=F("workflowdataconditiongroup__workflow_id"))
        .distinct()
    )
    workflows_by_id = {workflow.id: workflow for workflow in workflows}
    queue_items_by_project_id = DefaultDict[int, list[DelayedWorkflowItem]](list)
    current_time = timezone.now()
    for action_condition in action_conditions:
        workflow = workflows_by_id[action_condition.workflow_id]
        env = (
            Environment.objects.get_from_cache(id=workflow.environment_id)
            if workflow.environment_id
            else None
        )
        workflow_event_data = replace(event_data, workflow_env=env)
        group_evaluation, remaining_conditions = process_data_condition_group(
            action_condition, workflow_event_data
        )

        if remaining_conditions:
            # If there are remaining conditions for the action filter to evaluate,
            # then return the list of conditions to enqueue
            queue_items_by_project_id[event_data.event.group.project_id].append(
                DelayedWorkflowItem(
                    workflow,
                    remaining_conditions,
                    event_data.event,
                    WorkflowDataConditionGroupType.ACTION_FILTER,
                    timestamp=current_time,
                )
            )
        else:
            if group_evaluation.logic_result:
                filtered_action_groups.add(action_condition)

    enqueue_workflows(queue_items_by_project_id)

    logger.info(
        "workflow_engine.evaluate_workflows_action_filters",
        extra={
            "group_id": event_data.event.group_id,
            "event_id": event_data.event.event_id,
            "workflow_ids": [workflow.id for workflow in workflows],
            "action_conditions": [action_condition.id for action_condition in action_conditions],
            "filtered_action_groups": [action_group.id for action_group in filtered_action_groups],
        },
    )

    return filtered_action_groups


def get_environment_by_event(event_data: WorkflowEventData) -> Environment:
    try:
        environment = event_data.event.get_environment()
    except Environment.DoesNotExist:
        metrics_incr("process_workflows.error")
        logger.exception(
            "Missing environment for event", extra={"event_id": event_data.event.event_id}
        )
        raise Environment.DoesNotExist("Environment does not exist for the event")

    return environment


def _get_associated_workflows(
    detector: Detector, environment: Environment, event_data: WorkflowEventData
) -> set[Workflow]:
    """
    This is a wrapper method to get the workflows associated with a detector and environment.
    Used in process_workflows to wrap the query + logging into a single method
    """
    workflows = set(
        Workflow.objects.filter(
            (Q(environment_id=None) | Q(environment_id=environment.id)),
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

        logger.info(
            "workflow_engine.process_workflows",
            extra={
                "payload": event_data,
                "group_id": event_data.event.group_id,
                "event_id": event_data.event.event_id,
                "event_environment_id": environment.id,
                "workflows": [workflow.id for workflow in workflows],
                "detector_type": detector.type,
            },
        )

    return workflows


@log_context.root()
def process_workflows(event_data: WorkflowEventData) -> set[Workflow]:
    """
    This method will get the detector based on the event, and then gather the associated workflows.
    Next, it will evaluate the "when" (or trigger) conditions for each workflow, if the conditions are met,
    the workflow will be added to a unique list of triggered workflows.

    Finally, each of the triggered workflows will have their actions evaluated and executed.
    """
    try:
        detector = get_detector_by_event(event_data)
        log_context.add_extras(detector_id=detector.id)
        organization = detector.project.organization

        # set the detector / org information asap, this is used in `get_environment_by_event` as well.
        WorkflowEventContext.set(
            WorkflowEventContextData(
                detector=detector,
                organization=organization,
            )
        )
    except Detector.DoesNotExist:
        return set()

    try:
        environment = get_environment_by_event(event_data)

        # Set the full context now that we've gotten everything.
        WorkflowEventContext.set(
            WorkflowEventContextData(
                detector=detector,
                environment=environment,
                organization=organization,
            )
        )
    except Environment.DoesNotExist:
        return set()

    if features.has(
        "organizations:workflow-engine-metric-alert-dual-processing-logs", organization
    ):
        log_context.set_verbose(True)

    workflows = _get_associated_workflows(detector, environment, event_data)
    if not workflows:
        # If there aren't any workflows, there's nothing to evaluate
        return set()

    triggered_workflows = evaluate_workflow_triggers(workflows, event_data)
    if not triggered_workflows:
        # if there aren't any triggered workflows, there's no action filters to evaluate
        return set()

    actions_to_trigger = evaluate_workflows_action_filters(triggered_workflows, event_data)
    actions = filter_recently_fired_workflow_actions(actions_to_trigger, event_data)
    if not actions:
        # If there aren't any actions on the associated workflows, there's nothing to trigger
        return triggered_workflows
    create_workflow_fire_histories(detector, actions, event_data)

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
        if features.has(
            "organizations:workflow-engine-trigger-actions",
            organization,
        ):
            for action in actions:
                action.trigger(event_data, detector)
                metrics_incr(
                    "action.trigger",
                    tags={"action_type": action.type},
                )

                logger.info(
                    "workflow_engine.action.trigger",
                    extra={
                        "action_id": action.id,
                        "event_data": asdict(event_data),
                    },
                )
        else:
            logger.info(
                "workflow_engine.triggered_actions",
                extra={
                    "action_ids": [action.id for action in actions],
                    "event_data": asdict(event_data),
                },
            )
            # If the feature flag is not enabled, only send a metric
            for action in actions:
                metrics_incr(
                    "process_workflows.action_triggered",
                    1,
                    tags={"action_type": action.type},
                )
                logger.debug(
                    "workflow_engine.action.would-trigger",
                    extra={
                        "action_id": action.id,
                        "event_data": asdict(event_data),
                    },
                )

    # in order to check if workflow engine is firing 1:1 with the old system, we must only count once rather than each action
    if len(actions) > 0:
        metrics_incr("process_workflows.fired_actions")

    return triggered_workflows
