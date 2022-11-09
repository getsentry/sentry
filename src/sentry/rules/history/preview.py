from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Sequence

from django.utils import timezone

from sentry.db.models import BaseQuerySet
from sentry.models import Group, Project
from sentry.rules import rules
from sentry.rules.processor import get_match_function
from sentry.snuba.dataset import Dataset
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType
from sentry.utils.snuba import raw_query

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

    filter_objects = []
    event_columns = set()
    for filter in filters:
        filter_cls = rules.get(filter["id"])
        if filter_cls is None:
            return None
        filter_object = filter_cls(project, data=filter)
        filter_objects.append(filter_object)
        event_columns.update(filter_object.get_event_columns())

    filter_func = get_match_function(filter_match)
    if filter_func is None:
        return None

    event_map = {}
    # if there is an event filter, retrieve event data
    if event_columns:
        event_map = get_events(project, activity, list(event_columns))

    frequency = timedelta(minutes=frequency_minutes)
    group_last_fire: Dict[str, datetime] = {}
    group_ids = set()
    for event in activity:
        try:
            passes = [f.passes_activity(event, event_map) for f in filter_objects]
        except NotImplementedError:
            return None
        last_fire = group_last_fire.get(event.group_id, event.timestamp - frequency)
        if last_fire <= event.timestamp - frequency and filter_func(passes):
            group_ids.add(event.group_id)
            group_last_fire[event.group_id] = event.timestamp

    return Group.objects.filter(id__in=group_ids)


def get_events(
    project: Project, condition_activity: Sequence[ConditionActivity], columns: List[str]
) -> Dict[str, Any]:
    """
    Returns events that have caused issue state changes.
    """
    group_ids = []
    event_ids = []
    for activity in condition_activity:
        if activity.type == ConditionActivityType.CREATE_ISSUE:
            group_ids.append(activity.group_id)
        elif activity.type in (ConditionActivityType.REGRESSION, ConditionActivityType.REAPPEARED):
            event_id = activity.data.get("event_id", None)
            if event_id is not None:
                event_ids.append(event_id)

    columns.append("event_id")
    events = []
    if group_ids:
        events.extend(
            raw_query(  # retrieves the first event for each group
                dataset=Dataset.Events,
                filter_keys={"project_id": [project.id], "group_id": group_ids},
                orderby=["group_id", "timestamp"],
                limitby=(1, "group_id"),
                selected_columns=columns + ["group_id"],
            ).get("data", [])
        )
        # store event_ids for CREATE_ISSUE condition activities
        group_map = {event["group_id"]: event["event_id"] for event in events}
        for activity in condition_activity:
            if activity.type == ConditionActivityType.CREATE_ISSUE:
                activity.data = {"event_id": group_map.get(activity.group_id, None)}

    if event_ids:
        events.extend(
            raw_query(
                dataset=Dataset.Events,
                filter_keys={"project_id": [project.id], "event_id": event_ids},
                selected_columns=columns,
            ).get("data", [])
        )

    # the keys and values of tags come in 2 separate lists, pair them up together
    if "tags.key" in columns and "tags.value" in columns:
        for event in events:
            keys = event.pop("tags.key")
            values = event.pop("tags.value")
            event["tags"] = {k: v for k, v in zip(keys, values)}

    return {event["event_id"]: event for event in events}
