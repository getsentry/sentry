from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Detector, DetectorWorkflow, Workflow
from sentry.workflow_engine.types import DetectorType


def get_detector_by_event(evt: GroupEvent) -> Detector:
    issue_occurrence = evt.occurrence

    if issue_occurrence is None:
        # TODO - Don't hardcode the type as a string, make an enum
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


# TODO - should this return the list of actions or actually invoke them? :thinking:
def process_workflows(evt: GroupEvent):
    """
    The process_workflows method will:
    - take a data packet and the results
    - evaluate the workflows
    - then trigger any actions that are necessary.

    This method should be invoked inside of the issue platform, to ensure that the workflows are triggered
    with the correct IssueOccurrence information
    """
    # Check to see if the GroupEvent has an issue occurrence
    detector = get_detector_by_event(evt)

    # gather all the workflows based on the detector_id and dedupe the workflows
    dws = DetectorWorkflow.objects.filter(detector_id=detector.id).prefetch_related("workflow")
    workflows = {dw.workflow for dw in dws}

    # evaluate if the workflows should be triggered based on the event
    triggered_workflows = evaluate_workflow_triggers(workflows, evt)

    # get all of the data condition groups associated with the workflows in the action table.
    # TODO - create evaluate_workflow_actions(data_condition_groups, evt)

    return triggered_workflows
