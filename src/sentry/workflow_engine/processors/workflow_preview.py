import logging
from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, Detector
from sentry.workflow_engine.processors.data_condition import split_conditions_by_speed

logger = logging.getLogger(__name__)


@dataclass
class EvaluationGroup:
    logic_type: DataConditionGroup.Type
    conditions: list[DataCondition]


def preview_conditions(
    logic_type: DataConditionGroup.Type, conditions: list[DataCondition], group_ids: set[int]
) -> tuple[set[int], set[int]]:
    if not conditions:
        # no conditions, all groups are valid
        return set(), group_ids

    # groups that would have triggered each condition
    conditions_to_triggered_groups = {}

    for condition in conditions:
        conditions_to_triggered_groups[condition.id] = condition.get_preview_groups(group_ids)

    groups_to_check = set(group_ids)
    groups_meeting_conditions: set[int] = set()

    triggered_groups: list[set[int]] = list(conditions_to_triggered_groups.values())

    match logic_type:
        case DataConditionGroup.Type.ALL:
            # ALL logic type: intersection of all the groups that meet any condition (= met all conditions)
            # should only continue checking groups that have already met these conditions
            groups_meeting_conditions = set.intersection(*triggered_groups)
            groups_to_check = groups_meeting_conditions
        case DataConditionGroup.Type.NONE:
            # NONE logic type: all the group ids - intersection of all the groups that meet any condition (= did not meet any condition)
            # should only continue checking groups that did not meet any condition
            groups_meeting_conditions = groups_to_check - set().union(*triggered_groups)
            groups_to_check = groups_meeting_conditions
        case _:  # any or any_short_circuit
            # ANY logic type: union of all the groups that meet any condition
            # should only continue checking groups that have not already met these conditions
            groups_meeting_conditions = set().union(*triggered_groups)
            groups_to_check -= groups_meeting_conditions

    return groups_to_check, groups_meeting_conditions


def preview_condition_group(
    logic_type: DataConditionGroup.Type, conditions: list[DataCondition], group_ids: set[int]
) -> set[int]:
    # check fast conditions first
    fast_conditions, slow_conditions = split_conditions_by_speed(conditions)

    # TODO(cathy): early return if they are invalid condition pairs? see src/sentry/rules/history/preview.py VALID_CONDITION_PAIRS

    groups_to_check, groups_meeting_fast_conditions = preview_conditions(
        logic_type, fast_conditions, group_ids
    )

    if not groups_to_check:
        return groups_meeting_fast_conditions

    _, groups_meeting_conditions = preview_conditions(logic_type, slow_conditions, groups_to_check)

    return groups_meeting_conditions


# NOTE: assumes an enabled workflow
def preview_workflow(
    detectors: list[Detector],
    environment: Environment | None,
    trigger_condition_group: EvaluationGroup,
    filter_condition_groups: list[EvaluationGroup],
) -> set[int]:
    # TODO(cathy): account for environment (is it even possible without querying Snuba)?
    preview_groups: set[int] = set()

    # Get groups from the last 14 days with the same group type as the detectors
    group_types = {detector.group_type.type_id for detector in detectors}
    projects = {detector.project_id for detector in detectors}
    group_ids = set(
        Group.objects.filter(
            project__in=projects,
            last_seen__gte=timezone.now() - timedelta(days=14),
            type__in=group_types,
        ).values_list("id", flat=True)
    )

    if not group_ids:
        return preview_groups

    groups_meeting_triggers = preview_condition_group(
        trigger_condition_group.logic_type, trigger_condition_group.conditions, group_ids
    )

    for filter_group in filter_condition_groups:
        preview_groups.update(
            preview_condition_group(
                filter_group.logic_type, filter_group.conditions, groups_meeting_triggers
            )
        )

    return preview_groups
