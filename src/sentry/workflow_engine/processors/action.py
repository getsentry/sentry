from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.workflow_engine.models import Action, DataConditionGroup, Workflow
from sentry.workflow_engine.processors.data_condition_group import evaluate_condition_group
from sentry.workflow_engine.types import WorkflowJob


def evaluate_workflow_action_filters(
    workflows: set[Workflow], job: WorkflowJob
) -> BaseQuerySet[Action]:
    filtered_action_groups: set[DataConditionGroup] = set()

    # gets the list of the workflow ids, and then get the workflow_data_condition_groups for those workflows
    workflow_ids = {workflow.id for workflow in workflows}

    action_conditions = DataConditionGroup.objects.filter(
        workflowdataconditiongroup__workflow_id__in=workflow_ids
    ).distinct()

    for action_condition in action_conditions:
        evaluation, result = evaluate_condition_group(action_condition, job)

        if evaluation:
            filtered_action_groups.add(action_condition)

    # get the actions for any of the triggered data condition groups
    return Action.objects.filter(
        dataconditiongroupaction__condition_group__in=filtered_action_groups
    ).distinct()
