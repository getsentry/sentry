from datetime import datetime, timedelta

from django.db.models import DurationField, ExpressionWrapper, F, IntegerField, Value
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce
from django.utils import timezone

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.group import Group
from sentry.workflow_engine.models import Action, ActionGroupStatus, DataConditionGroup, Workflow
from sentry.workflow_engine.processors.data_condition_group import evaluate_condition_group
from sentry.workflow_engine.types import WorkflowJob


def get_action_last_updated_statuses(now: datetime, actions: BaseQuerySet[Action], group: Group):
    # Annotate the actions with the amount of time since the last update
    statuses = ActionGroupStatus.objects.filter(group=group, action__in=actions)

    check_workflow_frequency = Cast(
        Coalesce(
            KeyTextTransform(
                "frequency",
                F(
                    "action__dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow__config"
                ),
            ),
            Value("30"),  # default 30
        ),
        output_field=IntegerField(),
    )

    frequency_in_minutes = ExpressionWrapper(
        F("frequency") * timedelta(minutes=1),  # convert to timedelta
        output_field=DurationField(),
    )

    time_since_last_update = ExpressionWrapper(
        Value(now) - F("date_updated"), output_field=DurationField()
    )

    statuses = statuses.annotate(
        frequency=check_workflow_frequency,
        frequency_minutes=frequency_in_minutes,
        difference=time_since_last_update,
    )

    return statuses


# TODO(cathy): only reinforce workflow frequency for certain issue types
def filter_recently_fired_workflow_actions(
    actions: BaseQuerySet[Action], group: Group
) -> BaseQuerySet[Action]:
    now = timezone.now()
    statuses = get_action_last_updated_statuses(now, actions, group)

    actions_without_statuses = actions.exclude(id__in=statuses.values_list("action_id", flat=True))
    actions_to_include = set(
        statuses.filter(difference__gt=F("frequency_minutes")).values_list("action_id", flat=True)
    )

    ActionGroupStatus.objects.filter(action__in=actions_to_include, group=group).update(
        date_updated=now
    )
    ActionGroupStatus.objects.bulk_create(
        [
            ActionGroupStatus(action=action, group=group, date_updated=now)
            for action in actions_without_statuses
        ],
        batch_size=1000,
    )

    actions_without_statuses_ids = {action.id for action in actions_without_statuses}
    filtered_actions = actions.filter(id__in=actions_to_include | actions_without_statuses_ids)

    return filtered_actions


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
    actions = Action.objects.filter(
        dataconditiongroupaction__condition_group__in=filtered_action_groups
    ).distinct()

    return filter_recently_fired_workflow_actions(actions, job["event"].group)
