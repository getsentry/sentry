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
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
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

    logger.info(
        "workflow_engine.enqueue_workflow",
        extra={
            "workflow": workflow.id,
            "group_id": event.group_id,
            "event_id": event.event_id,
            "delayed_conditions": [condition.id for condition in delayed_conditions],
        },
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

    action_conditions = (
        DataConditionGroup.objects.filter(workflowdataconditiongroup__workflow__in=workflows)
        .prefetch_related("workflowdataconditiongroup_set")
        .distinct()
    )

    for action_condition in action_conditions:
        workflow_event_data = event_data

        # each DataConditionGroup here has 1 WorkflowDataConditionGroup
        workflow_data_condition_group = action_condition.workflowdataconditiongroup_set.first()

        # Populate the workflow_env in the event_data for the action_condition evaluation
        if workflow_data_condition_group:
            workflow_event_data = replace(
                workflow_event_data, workflow_env=workflow_data_condition_group.workflow.environment
            )
        else:
            logger.info(
                "workflow_engine.evaluate_workflows_action_filters.no_workflow_data_condition_group",
                extra={
                    "group_id": event_data.event.group_id,
                    "event_id": event_data.event.event_id,
                    "action_condition_id": action_condition.id,
                },
            )

        group_evaluation, remaining_conditions = process_data_condition_group(
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

    return filter_recently_fired_workflow_actions(filtered_action_groups, event_data)


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
        evt = event_data.event
        detector_id = evt.occurrence.evidence_data.get("detector_id") if evt.occurrence else None

        logger.exception(
            "Detector not found for event",
            extra={
                "event_id": evt.event_id,
                "group_id": evt.group_id,
                "detector_id": detector_id,
            },
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

    # TODO: remove fetching org, only used for feature flag checks
    organization = detector.project.organization

    # Get the workflows, evaluate the when_condition_group, finally evaluate the actions for workflows that are triggered
    workflows = set(
        Workflow.objects.filter(
            (Q(environment_id=None) | Q(environment_id=environment.id)),
            detectorworkflow__detector_id=detector.id,
            enabled=True,
        ).distinct()
    )

    if workflows:
        metrics.incr(
            "workflow_engine.process_workflows",
            len(workflows),
            tags={"detector_type": detector.type},
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

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.evaluate_workflow_triggers"):
        triggered_workflows = evaluate_workflow_triggers(workflows, event_data)

        if triggered_workflows:
            metrics.incr(
                "workflow_engine.process_workflows.triggered_workflows",
                len(triggered_workflows),
                tags={"detector_type": detector.type},
            )

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

    with sentry_sdk.start_span(
        op="workflow_engine.process_workflows.evaluate_workflows_action_filters"
    ):
        actions = evaluate_workflows_action_filters(triggered_workflows, event_data)
        metrics.incr(
            "workflow_engine.process_workflows.actions",
            amount=len(actions),
            tags={"detector_type": detector.type},
        )

        logger.info(
            "workflow_engine.process_workflows.actions (all)",
            extra={
                "group_id": event_data.event.group_id,
                "event_id": event_data.event.event_id,
                "workflow_ids": [workflow.id for workflow in triggered_workflows],
                "action_ids": [action.id for action in actions],
                "detector_type": detector.type,
            },
        )

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
        if features.has(
            "organizations:workflow-engine-trigger-actions",
            organization,
        ):
            for action in actions:
                action.trigger(event_data, detector)

        metrics.incr(
            "workflow_engine.process_workflows.triggered_actions",
            amount=len(actions),
            tags={"detector_type": detector.type},
        )
        logger.info(
            "workflow_engine.process_workflows.triggered_actions (batch)",
            extra={
                "group_id": event_data.event.group_id,
                "event_id": event_data.event.event_id,
                "workflow_ids": [workflow.id for workflow in triggered_workflows],
                "action_ids": [action.id for action in actions],
                "detector_type": detector.type,
            },
        )

    return triggered_workflows
