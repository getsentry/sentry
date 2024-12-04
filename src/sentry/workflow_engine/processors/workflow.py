from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Detector, Workflow
from sentry.workflow_engine.types import DetectorType


# TODO - cache these by evt.group_id? :thinking:
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


def process_workflows(evt: GroupEvent):
    # Check to see if the GroupEvent has an issue occurrence
    detector = get_detector_by_event(evt)

    workflows = set(Workflow.objects.filter(detectorworkflow__detector_id=detector.id).distinct())
    triggered_workflows = evaluate_workflow_triggers(workflows, evt)

    # get all the data_condition_group_ids from the triggered_workflows <=> workflow_data_condition_groups

    # TODO - create processors/action.py: evaluate_actions(data_condition_group_ids, evt)
    # TODO - decide if this should iterate the actions and call action.trigger
    #         or just return the list of actions
    #         or just return the trigger

    return triggered_workflows
