import logging
from dataclasses import asdict, replace
from enum import StrEnum

import sentry_sdk
from django.db import router, transaction
from django.db.models import F, Q

from sentry import buffer, features
from sentry.eventstore.models import GroupEvent
from sentry.models.activity import Activity, activity_creation_registry
from sentry.models.environment import Environment
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils import json
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
)
from sentry.workflow_engine.processors.action import (
    create_workflow_fire_histories,
    filter_recently_fired_actions,
)
from sentry.workflow_engine.processors.contexts.workflow_event_context import (
    WorkflowEventContext,
    WorkflowEventContextData,
)
from sentry.workflow_engine.processors.data_condition_group import process_data_condition_group
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils.metrics import metrics_incr

logger = logging.getLogger(__name__)

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


def enqueue_workflow(
    workflow: Workflow,
    delayed_conditions: list[DataCondition],
    event: GroupEvent,
    source: WorkflowDataConditionGroupType,
) -> None:
    project_id = event.group.project.id

    buffer.backend.push_to_sorted_set(key=WORKFLOW_ENGINE_BUFFER_LIST_KEY, value=project_id)

    condition_group_set = {condition.condition_group_id for condition in delayed_conditions}
    condition_groups = ",".join(
        str(condition_group_id) for condition_group_id in condition_group_set
    )

    value = json.dumps({"event_id": event.event_id, "occurrence_id": event.occurrence_id})
    buffer.backend.push_to_hash(
        model=Workflow,
        filters={"project_id": project_id},
        field=f"{workflow.id}:{event.group.id}:{condition_groups}:{source}",
        value=value,
    )


@sentry_sdk.trace
def evaluate_workflow_triggers(
    workflows: set[Workflow], event_data: WorkflowEventData
) -> set[Workflow]:
    triggered_workflows: set[Workflow] = set()
    for workflow in workflows:
        evaluation, remaining_conditions = workflow.evaluate_trigger_conditions(event_data)

        if remaining_conditions:
            enqueue_workflow(
                workflow,
                remaining_conditions,
                event_data.event,
                WorkflowDataConditionGroupType.WORKFLOW_TRIGGER,
            )
        else:
            if evaluation:
                triggered_workflows.add(workflow)

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
    for action_condition in action_conditions:
        workflow_event_data = replace(
            event_data, workflow_env=workflows_by_id[action_condition.workflow_id].environment
        )
        group_evaluation, remaining_conditions = process_data_condition_group(
            action_condition.id, workflow_event_data
        )

        if remaining_conditions:
            # If there are remaining conditions for the action filter to evaluate,
            # then return the list of conditions to enqueue
            enqueue_workflow(
                workflows_by_id[action_condition.workflow_id],
                remaining_conditions,
                event_data.event,
                WorkflowDataConditionGroupType.ACTION_FILTER,
            )
        else:
            if group_evaluation.logic_result:
                filtered_action_groups.add(action_condition)

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
        ).distinct()
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
                "detector_id": detector.id,
            },
        )

    return workflows


def process_workflows(event_data: WorkflowEventData) -> set[Workflow]:
    """
    This method will get the detector based on the event, and then gather the associated workflows.
    Next, it will evaluate the "when" (or trigger) conditions for each workflow, if the conditions are met,
    the workflow will be added to a unique list of triggered workflows.

    Finally, each of the triggered workflows will have their actions evaluated and executed.
    """
    try:
        detector = get_detector_by_event(event_data)
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

    workflows = _get_associated_workflows(detector, environment, event_data)
    if not workflows:
        # If there aren't any workflows, there's nothing to evaluate
        return set()

    triggered_workflows = evaluate_workflow_triggers(workflows, event_data)
    if not triggered_workflows:
        # if there aren't any triggered workflows, there's no action filters to evaluate
        return set()

    actions_to_trigger = evaluate_workflows_action_filters(triggered_workflows, event_data)
    actions = filter_recently_fired_actions(actions_to_trigger, event_data)
    if not actions:
        # If there aren't any actions on the associated workflows, there's nothing to trigger
        return triggered_workflows
    create_workflow_fire_histories(actions, event_data)

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
                        "detector_id": detector.id,
                        "action_id": action.id,
                        "event_data": asdict(event_data),
                    },
                )

    # in order to check if workflow engine is firing 1:1 with the old system, we must only count once rather than each action
    if len(actions) > 0:
        metrics_incr("process_workflows.fired_actions")

    return triggered_workflows


supported_activity_types = [ActivityType.SET_RESOLVED.value]


@activity_creation_registry.register("workflow_engine:process_workflows")
def handle_activity_creation(activity: Activity) -> None:
    if activity.type not in supported_activity_types:
        # TODO - Only support activity types that we have triggers for
        # For example, we don't want to process a workflow activity for DEPLOY
        return

    workflow_event_data = WorkflowEventData(
        event=activity,
        has_reappeared=activity.group.substatus == GroupSubStatus.REGRESSED,
        has_escalated=activity.group.substatus == GroupSubStatus.ESCALATING,
    )

    process_workflows(workflow_event_data)
