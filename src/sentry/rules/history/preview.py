from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Sequence

from django.utils import timezone

from sentry.db.models import BaseQuerySet
from sentry.models import Activity, Group, Project
from sentry.rules import rules
from sentry.rules.filters.assigned_to import AssignedToFilter
from sentry.rules.processor import get_match_function
from sentry.types.activity import ActivityType

PREVIEW_TIME_RANGE = timedelta(weeks=2)
# limit on number of ConditionActivity's a condition will return
# if limited, conditions should return the latest activity
CONDITION_ACTIVITY_LIMIT = 1000


def preview(
    project: Project,
    conditions: Sequence[Dict[str, Any]],
    filters: Sequence[Dict[str, Any]],
    condition_match: str,
    filter_match: str,
    frequency_minutes: int,
) -> BaseQuerySet | None:
    end = timezone.now()
    start = end - PREVIEW_TIME_RANGE

    # must have at least one condition to filter activity
    if len(conditions) == 0:
        return None
    # all the currently supported conditions are mutually exclusive
    elif len(conditions) > 1 and condition_match == "all":
        return Group.objects.none()

    activity = []
    group_ids = set()
    for condition in conditions:
        condition_cls = rules.get(condition["id"])
        if condition_cls is None:
            return None
        # instantiates a EventCondition subclass and retrieves activities related to it
        condition_inst = condition_cls(project, data=condition)
        try:
            condition_activity = condition_inst.get_activity(start, end, CONDITION_ACTIVITY_LIMIT)
            activity.extend(condition_activity)
            group_ids.update([activity.group_id for activity in condition_activity])
        except NotImplementedError:
            return None

    k = lambda a: a.timestamp
    activity.sort(key=k)

    assigned_to_filter = False
    filter_objects = []
    for filter in filters:
        filter_cls = rules.get(filter["id"])
        if filter_cls is None:
            return None
        filter_objects.append(filter_cls(project, data=filter))
        if filter_cls == AssignedToFilter:
            assigned_to_filter = True

    filter_func = get_match_function(filter_match)
    if filter_func is None:
        return None

    kwargs = {}
    assignee_status = {id: None for id in group_ids}
    assignee_activity = []
    if assigned_to_filter:
        # retrieve assigned/unassigned activities that happened in the interval
        assignee_activity = list(
            Activity.objects.filter(
                group__id__in=group_ids,
                type__in=(ActivityType.ASSIGNED.value, ActivityType.UNASSIGNED.value),
                datetime__gte=start,
                datetime__lt=end,
            ).order_by("datetime")[:CONDITION_ACTIVITY_LIMIT]
        )
        assignee_activity.reverse()
        kwargs["assignee_status"] = assignee_status

    frequency = timedelta(minutes=frequency_minutes)
    group_last_fire: Dict[str, datetime] = {}
    fired_group_ids = set()
    for event in activity:
        # update assignee statuses for activities that happened between the previous event and current one
        update_assignee(assignee_status, assignee_activity, event.timestamp)
        try:
            passes = [f.passes_activity(event, **kwargs) for f in filter_objects]
        except NotImplementedError:
            return None
        last_fire = group_last_fire.get(event.group_id, event.timestamp - frequency)
        if last_fire <= event.timestamp - frequency and filter_func(passes):
            fired_group_ids.add(event.group_id)
            group_last_fire[event.group_id] = event.timestamp

    return Group.objects.filter(id__in=fired_group_ids)


def update_assignee(
    assignee_status: Dict[str, Any], assignee_activity: List[Activity], timestamp: datetime
) -> None:
    while len(assignee_activity) > 0 and assignee_activity[-1].datetime < timestamp:
        activity = assignee_activity.pop()
        if activity.type == ActivityType.ASSIGNED.value:
            assignee_status[activity.group_id] = activity.data
        elif activity.type == ActivityType.UNASSIGNED.value:
            assignee_status[activity.group_id] = None
