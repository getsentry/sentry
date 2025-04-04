from datetime import datetime, timedelta

from django.db.models import DurationField, ExpressionWrapper, F, IntegerField, Value
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce
from django.utils import timezone

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.group import Group
from sentry.workflow_engine.models import (
    Action,
    ActionGroupStatus,
    DataCondition,
    DataConditionGroup,
    WorkflowDataConditionGroup,
    WorkflowFireHistory,
)
from sentry.workflow_engine.types import WorkflowEventData

EnqueuedAction = tuple[DataConditionGroup, list[DataCondition]]


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


def update_workflow_fire_histories(
    actions_to_fire: BaseQuerySet[Action], event_data: WorkflowEventData
) -> int:
    # Update WorkflowFireHistory objects for workflows with actions to fire
    fired_workflows = set(
        WorkflowDataConditionGroup.objects.filter(
            condition_group__dataconditiongroupaction__action__in=actions_to_fire
        ).values_list("workflow_id", flat=True)
    )

    updated_rows = WorkflowFireHistory.objects.filter(
        workflow_id__in=fired_workflows,
        group=event_data.event.group,
        event_id=event_data.event.event_id,
    ).update(has_fired_actions=True)

    return updated_rows


# TODO(cathy): only reinforce workflow frequency for certain issue types
def filter_recently_fired_workflow_actions(
    filtered_action_groups: set[DataConditionGroup], event_data: WorkflowEventData
) -> BaseQuerySet[Action]:
    # get the actions for any of the triggered data condition groups
    actions = Action.objects.filter(
        dataconditiongroupaction__condition_group__in=filtered_action_groups
    ).distinct()
    group = event_data.event.group

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
        ignore_conflicts=True,
    )

    actions_without_statuses_ids = {action.id for action in actions_without_statuses}
    filtered_actions = actions.filter(id__in=actions_to_include | actions_without_statuses_ids)

    update_workflow_fire_histories(filtered_actions, event_data)

    return filtered_actions
