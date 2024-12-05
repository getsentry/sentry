from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Detector, Workflow
from sentry.workflow_engine.processors.action import evaluate_workflow_action_filters
from sentry.workflow_engine.types import DetectorType


# TODO - cache these by evt.group_id? :thinking:
# TODO - Move to process_detector
def get_detector_by_event(evt: GroupEvent) -> Detector:
    issue_occurrence = evt.occurrence

    if issue_occurrence is None:
        detector = Detector.objects.get(project_id=evt.project_id, type=DetectorType.ERROR)
    else:
        detector = Detector.objects.get(id=issue_occurrence.evidence_data.get("detector_id", None))

    return detector


def evaluate_workflow_triggers(workflows: set[Workflow], evt: GroupEvent) -> set[Workflow]:
    triggered_workflows: set[Workflow] = set()

    for workflow in workflows:
        if workflow.evaluate_trigger_conditions(evt):
            triggered_workflows.add(workflow)

    return triggered_workflows


def process_workflows(evt: GroupEvent) -> set[Workflow]:
    # Check to see if the GroupEvent has an issue occurrence
    detector = get_detector_by_event(evt)

    workflows = set(Workflow.objects.filter(detectorworkflow__detector_id=detector.id).distinct())
    triggered_workflows = evaluate_workflow_triggers(workflows, evt)

    # get all the triggered_workflow_groups from the triggered_workflows <=> workflow_data_condition_groups
    # call `evaluate_workflow_actions` on the triggered groups, more or less the same as this stuff, but not triggered by an event.. is it?
    actions = set(evaluate_workflow_action_filters(triggered_workflows, evt))

    for action in actions:
        action.trigger(evt, detector)

    # TODO decide if this should return a tuple or not.
    return triggered_workflows
