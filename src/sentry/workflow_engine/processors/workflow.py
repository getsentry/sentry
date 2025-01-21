import logging
from collections import defaultdict

import sentry_sdk

from sentry import buffer
from sentry.utils import json, metrics
from sentry.workflow_engine.models import Detector, Workflow, WorkflowDataConditionGroup
from sentry.workflow_engine.models.workflow import get_slow_conditions
from sentry.workflow_engine.processors.action import evaluate_workflow_action_filters
from sentry.workflow_engine.processors.data_condition_group import evaluate_condition_group
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.types import WorkflowJob

logger = logging.getLogger(__name__)

WORKFLOW_ENGINE_BUFFER_LIST_KEY = "workflow_engine_delayed_processing_buffer"


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
        evaluation, result = evaluate_condition_group(action_condition, job)

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
        if workflow.evaluate_trigger_conditions(job):
            triggered_workflows.add(workflow)
        else:
            if get_slow_conditions(workflow):
                # enqueue to be evaluated later
                workflows_to_enqueue.add(workflow)

    if workflows_to_enqueue:
        enqueue_workflows(workflows_to_enqueue, job)

    return triggered_workflows


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
    actions = evaluate_workflow_action_filters(triggered_workflows, job)

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
        for action in actions:
            action.trigger(job, detector)

    return triggered_workflows
