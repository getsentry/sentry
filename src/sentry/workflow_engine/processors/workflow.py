import logging
from enum import StrEnum

import sentry_sdk

from sentry import buffer
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.eventstore.models import GroupEvent
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
from sentry.workflow_engine.types import WorkflowJob

logger = logging.getLogger(__name__)

WORKFLOW_ENGINE_BUFFER_LIST_KEY = "workflow_engine_delayed_processing_buffer"


class WorkflowDataConditionGroupType(StrEnum):
    ACTION_FILTER = "action_filter"
    WORKFLOW_TRIGGER = "workflow_trigger"


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
        filters={"project": project_id},
        field=f"{workflow.id}:{event.group.id}:{condition_groups}:{source}",
        value=value,
    )


def evaluate_workflow_triggers(workflows: set[Workflow], job: WorkflowJob) -> set[Workflow]:
    triggered_workflows: set[Workflow] = set()

    for workflow in workflows:
        evaluation, remaining_conditions = workflow.evaluate_trigger_conditions(job)

        if remaining_conditions:
            enqueue_workflow(
                workflow,
                remaining_conditions,
                job["event"],
                WorkflowDataConditionGroupType.WORKFLOW_TRIGGER,
            )
        else:
            if evaluation:
                triggered_workflows.add(workflow)

    return triggered_workflows


def evaluate_workflows_action_filters(
    workflows: set[Workflow],
    job: WorkflowJob,
) -> BaseQuerySet[Action]:
    filtered_action_groups: set[DataConditionGroup] = set()

    # gets the list of the workflow ids, and then get the workflow_data_condition_groups for those workflows
    workflow_ids = {workflow.id for workflow in workflows}

    action_conditions = DataConditionGroup.objects.filter(
        workflowdataconditiongroup__workflow_id__in=workflow_ids
    ).distinct()

    for action_condition in action_conditions:
        (evaluation, result), remaining_conditions = process_data_condition_group(
            action_condition.id, job
        )

        if remaining_conditions:
            # If there are remaining conditions for the action filter to evaluate,
            # then return the list of conditions to enqueue
            condition_group = action_condition.workflowdataconditiongroup_set.first()
            if condition_group:
                enqueue_workflow(
                    condition_group.workflow,
                    remaining_conditions,
                    job["event"],
                    WorkflowDataConditionGroupType.ACTION_FILTER,
                )
        else:
            if evaluation:
                filtered_action_groups.add(action_condition)

    return filter_recently_fired_workflow_actions(filtered_action_groups, job["event"].group)


def process_workflows(job: WorkflowJob) -> set[Workflow]:
    """
    This method will get the detector based on the event, and then gather the associated workflows.
    Next, it will evaluate the "when" (or trigger) conditions for each workflow, if the conditions are met,
    the workflow will be added to a unique list of triggered workflows.

    Finally, each of the triggered workflows will have their actions evaluated and executed.
    """
    # Check to see if the GroupEvent has an issue occurrence
    try:
        detector = get_detector_by_event(job)
    except Detector.DoesNotExist:
        metrics.incr("workflow_engine.process_workflows.error")
        logger.exception("Detector not found for event", extra={"event_id": job["event"].event_id})
        return set()

    # Get the workflows, evaluate the when_condition_group, finally evaluate the actions for workflows that are triggered
    workflows = set(Workflow.objects.filter(detectorworkflow__detector_id=detector.id).distinct())

    if workflows:
        metrics.incr(
            "workflow_engine.process_workflows",
            len(workflows),
            tags={"detector_type": detector.type},
        )

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.evaluate_workflow_triggers"):
        triggered_workflows = evaluate_workflow_triggers(workflows, job)

        if triggered_workflows:
            metrics.incr(
                "workflow_engine.process_workflows.triggered_workflows",
                len(triggered_workflows),
                tags={"detector_type": detector.type},
            )

    with sentry_sdk.start_span(
        op="workflow_engine.process_workflows.evaluate_workflows_action_filters"
    ):
        actions = evaluate_workflows_action_filters(triggered_workflows, job)

        metrics.incr(
            "workflow_engine.process_workflows.triggered_actions",
            len(actions),
            tags={"detector_type": detector.type},
        )

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
        for action in actions:
            action.trigger(job, detector)

    return triggered_workflows
