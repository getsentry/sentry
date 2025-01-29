import logging
from collections import defaultdict

import sentry_sdk

from sentry import buffer
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.utils import json, metrics
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.processors.action import filter_recently_fired_workflow_actions
from sentry.workflow_engine.processors.data_condition_group import evaluate_condition_group
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.types import WorkflowJob

logger = logging.getLogger(__name__)

WORKFLOW_ENGINE_BUFFER_LIST_KEY = "workflow_engine_delayed_processing_buffer"


# TODO remove this method
def get_data_condition_groups_to_fire(
    workflows: set[Workflow], job: WorkflowJob
) -> dict[int, list[int]]:
    workflow_action_groups: dict[int, list[int]] = defaultdict(list)

    workflow_ids = {workflow.id for workflow in workflows}

    workflow_dcgs = WorkflowDataConditionGroup.objects.filter(
        workflow_id__in=workflow_ids
    ).select_related("condition_group", "workflow")

    for workflow_dcg in workflow_dcgs:
        action_condition = workflow_dcg.condition_group
        evaluation, result, _ = evaluate_condition_group(action_condition, job)

        if evaluation:
            workflow_action_groups[workflow_dcg.workflow_id].append(action_condition.id)

    return workflow_action_groups


def enqueue_workflows(
    workflows: set[Workflow],
    job: WorkflowJob,
) -> None:
    event = job["event"]
    project_id = event.group.project.id
    workflow_action_groups = get_data_condition_groups_to_fire(workflows, job)

    for workflow in workflows:
        buffer.backend.push_to_sorted_set(key=WORKFLOW_ENGINE_BUFFER_LIST_KEY, value=project_id)

        action_filters = workflow_action_groups.get(workflow.id, [])
        if not action_filters:
            continue

        action_filter_fields = ":".join(map(str, action_filters))

        value = json.dumps({"event_id": event.event_id, "occurrence_id": event.occurrence_id})
        buffer.backend.push_to_hash(
            model=Workflow,
            filters={"project": project_id},
            field=f"{workflow.id}:{event.group.id}:{action_filter_fields}",
            value=value,
        )


def evaluate_workflow_triggers(workflows: set[Workflow], job: WorkflowJob) -> set[Workflow]:
    triggered_workflows: set[Workflow] = set()
    workflows_to_enqueue: set[Workflow] = set()

    for workflow in workflows:
        evaluation, remaining_conditions = workflow.evaluate_trigger_conditions(job)
        if remaining_conditions:
            workflows_to_enqueue.add(workflow)
        else:
            if evaluation:
                # Only add workflows that have no remaining conditions to check
                triggered_workflows.add(workflow)

    if workflows_to_enqueue:
        enqueue_workflows(workflows_to_enqueue, job)

    return triggered_workflows


def evaluate_workflows_action_filters(
    workflows: set[Workflow],
    job: WorkflowJob,
) -> BaseQuerySet[Action]:
    filtered_action_groups: set[DataConditionGroup] = set()
    enqueued_conditions: list[DataCondition] = []

    # gets the list of the workflow ids, and then get the workflow_data_condition_groups for those workflows
    workflow_ids = {workflow.id for workflow in workflows}

    action_conditions = DataConditionGroup.objects.filter(
        workflowdataconditiongroup__workflow_id__in=workflow_ids
    ).distinct()

    for action_condition in action_conditions:
        evaluation, result, remaining_conditions = evaluate_condition_group(action_condition, job)

        if remaining_conditions:
            # If there are remaining conditions for the action filter to evaluate,
            # then return the list of conditions to enqueue
            enqueued_conditions.extend(remaining_conditions)
        else:
            # if we don't have any other conditions to evaluate, add the action to the list
            if evaluation:
                filtered_action_groups.add(action_condition)

    # get the actions for any of the triggered data condition groups
    actions = Action.objects.filter(
        dataconditiongroupaction__condition_group__in=filtered_action_groups
    ).distinct()

    return filter_recently_fired_workflow_actions(actions, job["event"].group)


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
    triggered_workflows = evaluate_workflow_triggers(workflows, job)
    actions = evaluate_workflows_action_filters(triggered_workflows, job)

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
        for action in actions:
            action.trigger(job, detector)

    return triggered_workflows
