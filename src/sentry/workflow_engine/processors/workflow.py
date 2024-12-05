import logging

import sentry_sdk

from sentry.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.workflow_engine.models import Detector, Workflow
from sentry.workflow_engine.processors.action import evaluate_workflow_action_filters
from sentry.workflow_engine.processors.detector import get_detector_by_event

logger = logging.getLogger(__name__)


def evaluate_workflow_triggers(workflows: set[Workflow], evt: GroupEvent) -> set[Workflow]:
    triggered_workflows: set[Workflow] = set()

    for workflow in workflows:
        if workflow.evaluate_trigger_conditions(evt):
            triggered_workflows.add(workflow)

    return triggered_workflows


def process_workflows(evt: GroupEvent) -> set[Workflow]:
    """
    This method will get the detector based on the event, and then gather the associated workflows.
    Next, it will evaluate the "when" (or trigger) conditions for each workflow, if the conditions are met,
    the workflow will be added to a unique list of triggered workflows.

    Finally, each of the triggered workflows will have their actions evaluated and executed.
    """
    # Check to see if the GroupEvent has an issue occurrence
    try:
        detector = get_detector_by_event(evt)
    except Detector.DoesNotExist:
        metrics.incr("workflow_engine.process_workflows.error")
        logger.exception("Detector not found for event", extra={"event_id": evt.event_id})
        return set()

    # Get the workflows, evaluate the when_condition_group, finally evaluate the actions for workflows that are triggered
    workflows = set(Workflow.objects.filter(detectorworkflow__detector_id=detector.id).distinct())
    triggered_workflows = evaluate_workflow_triggers(workflows, evt)
    actions = evaluate_workflow_action_filters(triggered_workflows, evt)

    with sentry_sdk.start_span(op="workflow_engine.process_workflows.trigger_actions"):
        for action in actions:
            action.trigger(evt, detector)

    return triggered_workflows
