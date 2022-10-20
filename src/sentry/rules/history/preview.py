from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, Sequence

from django.utils import timezone

from sentry.db.models import BaseQuerySet
from sentry.models import Group, Project
from sentry.rules import rules

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

    # must have at least one condition to filter activity. Filters currently not supported
    if len(conditions) == 0 or len(filters):
        return None
    # all the currently supported conditions are mutually exclusive
    elif len(conditions) > 1 and condition_match == "all":
        return Group.objects.none()

    activity = []
    for condition in conditions:
        condition_cls = rules.get(condition["id"])
        if condition_cls is None:
            return None
        # instantiates a EventCondition subclass and retrieves activities related to it
        condition_inst = condition_cls(project, data=condition)
        try:
            activity.extend(condition_inst.get_activity(start, end, CONDITION_ACTIVITY_LIMIT))
        except NotImplementedError:
            return None

    k = lambda a: a.timestamp
    activity.sort(key=k)

    frequency = timedelta(minutes=frequency_minutes)
    last_fire = start - frequency
    group_ids = set()
    for event in activity:
        # TODO: check conditions and filters to see if event passes, not needed for just FirstSeenEventCondition
        if last_fire <= event.timestamp - frequency:
            group_ids.add(event.group_id)
            last_fire = event.timestamp

    return Group.objects.filter(id__in=group_ids)
