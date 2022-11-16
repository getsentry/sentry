from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Sequence, Tuple

from django.utils import timezone

from sentry.db.models import BaseQuerySet
from sentry.models import Group, Project
from sentry.rules import RuleBase, rules
from sentry.rules.processor import get_match_function
from sentry.snuba.dataset import Dataset
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType
from sentry.utils.snuba import raw_query

Conditions = Sequence[Dict[str, Any]]
ConditionFunc = Callable[[Sequence[bool]], bool]
GroupActivityMap = Dict[str, List[ConditionActivity]]

PREVIEW_TIME_RANGE = timedelta(weeks=2)
# limit on number of ConditionActivity's a condition will return
# if limited, conditions should return the latest activity
CONDITION_ACTIVITY_LIMIT = 1000


def preview(
    project: Project,
    conditions: Conditions,
    filters: Conditions,
    condition_match: str,
    filter_match: str,
    frequency_minutes: int,
) -> BaseQuerySet | None:
    """
    Returns groups that would have triggered the given conditions and filters in the past 2 weeks
    """
    end = timezone.now()
    start = end - PREVIEW_TIME_RANGE

    # must have at least one condition to filter activity
    if len(conditions) == 0:
        return None
    # all the currently supported conditions are mutually exclusive
    elif len(conditions) > 1 and condition_match == "all":
        return Group.objects.none()

    try:
        group_activity = get_group_activity(project, conditions, start, end)
        filter_objects, filter_func, event_columns = get_filters(project, filters, filter_match)

        event_map = {}
        # if there is an event filter, retrieve event data
        if event_columns:
            event_map = get_events(project, group_activity, event_columns)

        frequency = timedelta(minutes=frequency_minutes)
        group_ids = get_fired_groups(
            group_activity, filter_objects, filter_func, start, frequency, event_map
        )

        return Group.objects.filter(id__in=group_ids)
    except PreviewException:
        return None


def get_group_activity(
    project: Project, conditions: Conditions, start: datetime, end: datetime
) -> GroupActivityMap:
    """
    Returns a list of issue state change activities for each active group in the given time range
    """
    group_activity = defaultdict(list)
    for condition in conditions:
        condition_cls = rules.get(condition["id"])
        if condition_cls is None:
            raise PreviewException
        # instantiates a EventCondition subclass and retrieves activities related to it
        condition_inst = condition_cls(project, data=condition)
        try:
            activities = condition_inst.get_activity(start, end, CONDITION_ACTIVITY_LIMIT)
            for activity in activities:
                group_activity[activity.group_id].append(activity)
        except NotImplementedError:
            raise PreviewException

    k = lambda a: a.timestamp
    for activities in group_activity.values():
        activities.sort(key=k)

    return group_activity


def get_filters(
    project: Project, filters: Conditions, filter_match: str
) -> Tuple[Sequence[RuleBase], ConditionFunc, List[str]]:
    """
    Returns instantiated filter objects, the filter match function, and relevant snuba columns used for answering event filters
    """
    filter_objects = []
    event_columns = set()
    for filter in filters:
        filter_cls = rules.get(filter["id"])
        if filter_cls is None:
            raise PreviewException
        filter_object = filter_cls(project, data=filter)
        filter_objects.append(filter_object)
        try:
            event_columns.update(filter_object.get_event_columns())
        except NotImplementedError:
            raise PreviewException

    filter_func = get_match_function(filter_match)
    if filter_func is None:
        raise PreviewException

    return filter_objects, filter_func, list(event_columns)


def get_fired_groups(
    group_activity: GroupActivityMap,
    filter_objects: Sequence[RuleBase],
    filter_func: ConditionFunc,
    start: datetime,
    frequency: timedelta,
    event_map: Dict[str, Any],
) -> Sequence[str]:
    """
    Applies filter objects to the condition activity, returns the group ids of activities that pass the filters
    """
    group_ids = set()
    for group, activities in group_activity.items():
        last_fire = start - frequency
        for event in activities:
            try:
                passes = [f.passes_activity(event, event_map) for f in filter_objects]
            except NotImplementedError:
                raise PreviewException
            if last_fire <= event.timestamp - frequency and filter_func(passes):
                # XXX: we could break after adding the group, but we may potentially want the times of fires later
                group_ids.add(group)
                last_fire = event.timestamp

    return list(group_ids)


def get_events(
    project: Project, group_activity: GroupActivityMap, columns: List[str]
) -> Dict[str, Any]:
    """
    Returns events that have caused issue state changes.
    """
    group_ids = []
    event_ids = []
    for group, activities in group_activity.items():
        for activity in activities:
            if activity.type == ConditionActivityType.CREATE_ISSUE:
                group_ids.append(activity.group_id)
            elif activity.type in (
                ConditionActivityType.REGRESSION,
                ConditionActivityType.REAPPEARED,
            ):
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
        for group, activities in group_activity.items():
            # if there is a CREATE_ISSUE activity, it must be the first
            if activities[0].type == ConditionActivityType.CREATE_ISSUE:
                event_id = group_map.get(group, None)
                if event_id is not None:
                    activities[0].data = {"event_id": event_id}

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


class PreviewException(Exception):
    pass
