import logging
from dataclasses import asdict, replace
from enum import StrEnum

import sentry_sdk
from django.db import router, transaction
from django.db.models import Q

from sentry import buffer, features
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.eventstore.models import GroupEvent
from sentry.models.environment import Environment
from sentry.utils import json, metrics
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
    WorkflowDataConditionGroup,
    WorkflowFireHistory,
)
from sentry.workflow_engine.processors.action import filter_recently_fired_workflow_actions
from sentry.workflow_engine.processors.data_condition_group import process_data_condition_group
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)

WORKFLOW_ENGINE_BUFFER_LIST_KEY = "workflow_engine_delayed_processing_buffer"


class WorkflowDataConditionGroupType(StrEnum):
    ACTION_FILTER = "action_filter"
    WORKFLOW_TRIGGER = "workflow_trigger"


def get_actions_to_workflows(actions_to_fire: list[Action]) -> dict[int, Workflow]:
    action_ids = {action.id for action in actions_to_fire}
    workflow_actions = (
        WorkflowDataConditionGroup.objects.select_related("workflow", "condition_group")
        .filter(condition_group__dataconditiongroupaction__action_id__in=action_ids)
        .values_list("condition_group__dataconditiongroupaction__action_id", "workflow_id")
    )

    action_to_workflows: dict[int, int] = {
        action_id: workflow_id for action_id, workflow_id in workflow_actions
    }
    workflow_ids = set(action_to_workflows.values())

    workflows = Workflow.objects.filter(id__in=workflow_ids)
    workflow_ids_to_workflows = {workflow.id: workflow for workflow in workflows}

    # TODO: account for actions being attached to multiple workflows?
    # should you even send multiple notifications then? :think:
    actions_to_workflows: dict[int, Workflow] = {
        action_id: workflow_ids_to_workflows[workflow_id]
        for action_id, workflow_id in action_to_workflows.items()
    }
    return actions_to_workflows


def create_workflow_fire_histories(
    actions_to_workflows: dict[int, Workflow], event_data: WorkflowEventData
) -> dict[int, WorkflowFireHistory]:
    workflows = set(actions_to_workflows.values())

    workflow_fire_histories = [
        WorkflowFireHistory(
            workflow=workflow,
            group=event_data.event.group,
            event_id=event_data.event.event_id,
        )
        for workflow in workflows
    ]
    fire_histories = WorkflowFireHistory.objects.bulk_create(workflow_fire_histories)

    workflow_id_to_fire_history: dict[int, WorkflowFireHistory] = {
        workflow_fire_history.workflow_id: workflow_fire_history
        for workflow_fire_history in fire_histories
    }
    return workflow_id_to_fire_history


def fire_actions(actions: list[Action], detector: Detector, event_data: WorkflowEventData) -> None:
    actions_to_workflows = get_actions_to_workflows(actions)
    workflow_id_to_fire_history = create_workflow_fire_histories(actions_to_workflows, event_data)

    if features.has(
        "organizations:workflow-engine-trigger-actions",
        detector.project.organization,
    ):
        for action in actions:
            workflow = actions_to_workflows[action.id]
            workflow_event_data = replace(
                event_data, workflow_env=workflow.environment, workflow_id=workflow.id
            )

            notification_uuid = workflow_id_to_fire_history[workflow.id].notification_uuid
            action.trigger(workflow_event_data, detector, notification_uuid)


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

    return triggered_workflows


def evaluate_workflows_action_filters(
    workflows: set[Workflow],
    event_data: WorkflowEventData,
) -> BaseQuerySet[Action]:
    filtered_action_groups: set[DataConditionGroup] = set()

    # Gets the list of the workflow ids, and then get the workflow_data_condition_groups for those workflows
    workflow_ids_to_envs = {workflow.id: workflow.environment for workflow in workflows}

    action_conditions: BaseQuerySet[DataConditionGroup] = (
        DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow_id__in=list(workflow_ids_to_envs.keys())
        )
        .prefetch_related("workflowdataconditiongroup_set")
        .distinct()
    )

    for action_condition in action_conditions:
        workflow_event_data = event_data

        workflow_data_condition_group = action_condition.workflowdataconditiongroup_set.first()

        # Populate the workflow_env in the event_data for the action_condition evaluation
        if workflow_data_condition_group:
            workflow_event_data = replace(
                workflow_event_data, workflow_env=workflow_data_condition_group.workflow.environment
            )

        (evaluation, result), remaining_conditions = process_data_condition_group(
            action_condition.id, workflow_event_data
        )

        if remaining_conditions:
            # If there are remaining conditions for the action filter to evaluate,
            # then return the list of conditions to enqueue
            if workflow_data_condition_group:
                enqueue_workflow(
                    workflow_data_condition_group.workflow,
                    remaining_conditions,
                    event_data.event,
                    WorkflowDataConditionGroupType.ACTION_FILTER,
                )
        else:
            if evaluation:
                filtered_action_groups.add(action_condition)

    return filter_recently_fired_workflow_actions(filtered_action_groups, event_data.event.group)


def log_fired_workflows(
    log_name: str, actions: list[Action], event_data: WorkflowEventData
) -> None:
    # go from actions to workflows
    action_ids = {action.id for action in actions}
    action_conditions = DataConditionGroup.objects.filter(
        dataconditiongroupaction__action_id__in=action_ids
    ).values_list("id", flat=True)
    workflows_to_fire = Workflow.objects.filter(
        workflowdataconditiongroup__condition_group_id__in=action_conditions
    )
    workflow_to_rule = dict(
        AlertRuleWorkflow.objects.filter(workflow__in=workflows_to_fire).values_list(
            "workflow_id", "rule_id"
        )
    )

    for workflow in workflows_to_fire:
        logger.info(
            log_name,
            extra={
                "workflow_id": workflow.id,
                "rule_id": workflow_to_rule.get(workflow.id),
                "payload": asdict(event_data),
                "group_id": event_data.event.group_id,
                "event_id": event_data.event.event_id,
            },
        )


def process_workflows(event_data: WorkflowEventData) -> set[Workflow]:
    """
    This method will get the detector based on the event, and then gather the associated workflows.
    Next, it will evaluate the "when" (or trigger) conditions for each workflow, if the conditions are met,
    the workflow will be added to a unique list of triggered workflows.

    Finally, each of the triggered workflows will have their actions evaluated and executed.
    """
    # Check to see if the GroupEvent has an issue occurrence
    try:
        detector = get_detector_by_event(event_data)
    except Detector.DoesNotExist:
        metrics.incr("workflow_engine.process_workflows.error")
        logger.exception(
            "Detector not found for event", extra={"event_id": event_data.event.event_id}
        )
        return set()

    try:
        environment = event_data.event.get_environment()
    except Environment.DoesNotExist:
        metrics.incr("workflow_engine.process_workflows.error")
        logger.exception(
            "Missing environment for event", extra={"event_id": event_data.event.event_id}
        )
        return set()

    # TODO: remove fetching org, only used for FF check
    organization = detector.project.organization

    # Get the workflows, evaluate the when_condition_group, finally evaluate the actions for workflows that are triggered
    workflows = set(
        Workflow.objects.filter(
            (Q(environment_id=None) | Q(environment_id=environment.id)),
            detectorworkflow__detector_id=detector.id,
            enabled=True,
        ).distinct()
    )

    if features.has(
        "organizations:workflow-engine-process-workflows-logs",
        organization,
    ):
        logger.info(
            "workflow_engine.process_workflows.process_event",
            extra={
                "payload": event_data,
                "group_id": event_data.event.group_id,
                "event_id": event_data.event.event_id,
                "event_environment_id": environment.id,
                "workflows": [workflow.id for workflow in workflows],
            },
        )

    if workflows:
        metrics.incr(
            "workflow_engine.process_workflows",
            len(workflows),
            tags={"detector_type": detector.type},
        )

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.evaluate_workflow_triggers"):
        triggered_workflows = evaluate_workflow_triggers(workflows, event_data)

        if triggered_workflows:
            metrics.incr(
                "workflow_engine.process_workflows.triggered_workflows",
                len(triggered_workflows),
                tags={"detector_type": detector.type},
            )

    with sentry_sdk.start_span(
        op="workflow_engine.process_workflows.evaluate_workflows_action_filters"
    ):
        actions = evaluate_workflows_action_filters(triggered_workflows, event_data)

        if features.has(
            "organizations:workflow-engine-process-workflows",
            organization,
        ):
            metrics.incr(
                "workflow_engine.process_workflows.triggered_actions",
                amount=len(actions),
                tags={"detector_type": detector.type},
            )

        if features.has(
            "organizations:workflow-engine-process-workflows-logs",
            organization,
        ):
            log_fired_workflows(
                log_name="workflow_engine.process_workflows.fired_workflow",
                actions=list(actions),
                event_data=event_data,
            )

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
        fire_actions(list(actions), detector, event_data)

    return triggered_workflows


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
