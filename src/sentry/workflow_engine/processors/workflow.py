from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Action, DataConditionGroup, Detector, Workflow
from sentry.workflow_engine.processors.data_condition_group import evaluate_condition_group
from sentry.workflow_engine.types import DetectorType


# TODO - cache these by evt.group_id? :thinking:
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


def evaluate_workflow_action_filters(
    workflows: set[Workflow], evt: GroupEvent
) -> BaseQuerySet[Action]:
    filtered_action_groups: set[DataConditionGroup] = set()

    # gets the list of the workflow ids, and then get the workflow_data_condition_groups for those workflows
    workflow_ids = {workflow.id for workflow in workflows}

    action_conditions = DataConditionGroup.objects.filter(
        workflowdataconditiongroup__workflow_id__in=workflow_ids
    ).distinct()

    for action_condition in action_conditions:
        evaluation, result = evaluate_condition_group(action_condition, evt)

        if evaluation:
            filtered_action_groups.add(action_condition)

    # get the actions for any of the triggered data condition groups
    return Action.objects.filter(
        dataconditiongroupaction__condition_group__in=filtered_action_groups
    ).distinct()


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
