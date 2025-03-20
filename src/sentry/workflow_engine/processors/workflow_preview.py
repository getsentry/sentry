import logging
from datetime import timedelta

from django.utils import timezone

from sentry.models.group import Group
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.processors.data_condition import split_conditions_by_speed
from sentry.workflow_engine.processors.data_condition_group import get_data_conditions_for_group

logger = logging.getLogger(__name__)


def preview_conditions(
    logic_type: DataConditionGroup.Type, data_conditions: list[DataCondition], group_ids: set[int]
) -> tuple[set[int], set[int]]:
    # groups that would have triggered each condition
    conditions_to_triggered_groups = {}

    for condition in data_conditions:
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
        case DataConditionGroup.Type.ANY:
            # ANY logic type: union of all the groups that meet any condition
            # should only continue checking groups that have not already met these conditions
            groups_meeting_conditions = set().union(*triggered_groups)
            groups_to_check -= groups_meeting_conditions
        case DataConditionGroup.Type.ANY_SHORT_CIRCUIT:
            groups_meeting_conditions = set().union(*triggered_groups)
            groups_to_check -= groups_meeting_conditions
        case DataConditionGroup.Type.NONE:
            # NONE logic type: all the group ids - intersection of all the groups that meet any condition (= did not meet any condition)
            # should only continue checking groups that did not meet any condition
            groups_meeting_conditions = groups_to_check - set().union(*triggered_groups)
            groups_to_check = groups_meeting_conditions

    return groups_to_check, groups_meeting_conditions


def preview_data_condition_group(data_condition_group_id: int, group_ids: set[int]) -> set[int]:
    try:
        dcg = DataConditionGroup.objects.get_from_cache(id=data_condition_group_id)
    except DataConditionGroup.DoesNotExist:
        logger.exception(
            "DataConditionGroup does not exist",
            extra={"id": data_condition_group_id},
        )
        return set()

    try:
        logic_type = DataConditionGroup.Type(dcg.logic_type)
    except ValueError:
        logger.exception(
            "Invalid DataConditionGroup.logic_type found in process_data_condition_group",
            extra={"logic_type": dcg.logic_type},
        )
        return set()

    conditions = get_data_conditions_for_group(data_condition_group_id)

    # check fast conditions first
    fast_conditions, slow_conditions = split_conditions_by_speed(conditions)

    # TODO: early return if they are invalid conditon pairs? see src/sentry/rules/history/preview.py VALID_CONDITION_PAIRS

    groups_to_check, groups_meeting_fast_conditions = preview_conditions(
        logic_type, fast_conditions, group_ids
    )

    if not groups_to_check:
        return groups_meeting_fast_conditions

    _, groups_meeting_conditions = preview_conditions(logic_type, slow_conditions, groups_to_check)

    return groups_meeting_conditions


def preview_workflow(workflow: Workflow) -> set[int]:
    preview_groups: set[int] = set()

    if not workflow.enabled:
        return preview_groups

    # Get enabled detectors connected to Workflow
    detectors = set(
        Detector.objects.filter(
            detectorworkflow__workflow_id=workflow.id,
            enabled=True,
        ).distinct()
    )

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

    # Filter groups based on workflow triggers
    if not workflow.when_condition_group:
        return preview_groups

    groups_meeting_triggers = preview_data_condition_group(
        workflow.when_condition_group.id, group_ids
    )

    # Filter groups based on workflow filters
    filter_groups = WorkflowDataConditionGroup.objects.filter(workflow=workflow)

    if not filter_groups:
        return groups_meeting_triggers

    for filter_group in filter_groups:
        # TODO: should we have a separate list per filter group?
        preview_groups.update(
            preview_data_condition_group(filter_group.id, groups_meeting_triggers)
        )

    return preview_groups
