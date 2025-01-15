import logging
import random

import sentry_sdk

from sentry import buffer
from sentry.eventstore.models import GroupEvent
from sentry.models.project import Project
from sentry.utils import json, metrics
from sentry.workflow_engine.models import DataCondition, Detector, Workflow
from sentry.workflow_engine.models.workflow import get_slow_conditions
from sentry.workflow_engine.processors.action import evaluate_workflow_action_filters
from sentry.workflow_engine.processors.detector import get_detector_by_event
from sentry.workflow_engine.types import WorkflowJob

logger = logging.getLogger(__name__)

WORKFLOW_ENGINE_PROJECT_ID_BUFFER_LIST_KEY = "workflow_engine_project_id_buffer_list"


def enqueue_workflow(
    workflow: Workflow, event: GroupEvent, slow_conditions: list[DataCondition]
) -> None:
    project_id = event.group.project.id
    if random.random() < 0.01:
        logger.info(
            "process_workflows.workflow_enqueued",
            extra={"workflow": workflow.id, "group": event.group.id, "project": project_id},
        )
    buffer.backend.push_to_sorted_set(
        WORKFLOW_ENGINE_PROJECT_ID_BUFFER_LIST_KEY, workflow.organization
    )

    slow_condition_ids = [condition.id for condition in slow_conditions]
    slow_condition_fields = ":".join(map(str, slow_condition_ids))

    value = json.dumps({"event_id": event.event_id, "occurrence_id": event.occurrence_id})
    buffer.backend.push_to_hash(
        model=Project,
        filters={"project": project_id},
        field=f"{workflow.id}:{event.group.id}:{slow_condition_fields}",
        value=value,
    )
    metrics.incr("delayed_workflow.group_added")


def evaluate_workflow_triggers(workflows: set[Workflow], job: WorkflowJob) -> set[Workflow]:
    triggered_workflows: set[Workflow] = set()

    for workflow in workflows:
        if workflow.evaluate_trigger_conditions(job):
            triggered_workflows.add(workflow)
        else:
            if slow_conditions := get_slow_conditions(workflow):
                # enqueue to be evaluated later
                enqueue_workflow(workflow, job["event"], slow_conditions)

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
