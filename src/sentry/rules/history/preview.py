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
from sentry.types.condition_activity import (
    FREQUENCY_CONDITION_BUCKET_SIZE,
    ConditionActivity,
    ConditionActivityType,
)
from sentry.types.issues import GROUP_TYPE_TO_CATEGORY, GroupCategory, GroupType
from sentry.utils.snuba import parse_snuba_datetime, raw_query

Conditions = Sequence[Dict[str, Any]]
ConditionFunc = Callable[[Sequence[bool]], bool]
GroupActivityMap = Dict[str, List[ConditionActivity]]

PREVIEW_TIME_RANGE = timedelta(weeks=2)
# limit on number of ConditionActivity's a condition will return
# if limited, conditions should return the latest activity
CONDITION_ACTIVITY_LIMIT = 1000
FREQUENCY_CONDITION_GROUP_LIMIT = 10
ISSUE_STATE_CONDITIONS = [
    "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
    "sentry.rules.conditions.regression_event.RegressionEventCondition",
    "sentry.rules.conditions.reappeared_event.ReappearedEventCondition",
]

GROUP_CATEGORY_TO_DATASET = {
    GroupCategory.ERROR: Dataset.Events,
    GroupCategory.PERFORMANCE: Dataset.Transactions,
}


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

    issue_state_conditions, frequency_conditions = categorize_conditions(conditions)

    # must have at least one issue state condition to filter activity
    # TODO: support cases where there are only freq conditions
    if not issue_state_conditions:
        return None
    # all the issue state conditions are mutually exclusive
    elif len(issue_state_conditions) > 1 and condition_match == "all":
        return Group.objects.none()

    try:
        group_activity = get_issue_state_activity(project, issue_state_conditions, start, end)
        filter_objects, filter_func, event_columns = get_filters(project, filters, filter_match)

        # frequency conditions triggers are approximated, so they're not tied to an actual event object.
        # We cannot get any event data and answer any event-related filters
        if frequency_conditions and event_columns:
            return None

        event_map = {}
        # if there is an event filter, retrieve event data
        if event_columns:
            event_map = get_events(project, group_activity, event_columns)

        if frequency_conditions:
            group_activity = apply_frequency_conditions(
                project,
                start,
                end,
                get_top_groups(project, start, end, group_activity),
                frequency_conditions,
                condition_match,
            )

        frequency = timedelta(minutes=frequency_minutes)
        group_ids = get_fired_groups(
            group_activity, filter_objects, filter_func, start, frequency, event_map
        )

        return Group.objects.filter(id__in=group_ids)
    except PreviewException:
        return None


def categorize_conditions(conditions: Conditions) -> Tuple[Conditions, Conditions]:
    """
    Categorizes conditions into issue state conditions or frequency conditions.
    These two types of conditions are processed separately.

    Also deduplicates conditions, mainly for issue state conditions since they don't have params
    so there can be at most 3, and some of the preview logic after assumes they are unique.
    """
    issue_state_conditions = set()
    frequency_conditions = []
    for condition in conditions:
        if condition["id"] in ISSUE_STATE_CONDITIONS:
            issue_state_conditions.add(condition["id"])
        else:
            frequency_conditions.append(condition)
    return [{"id": condition_id} for condition_id in issue_state_conditions], frequency_conditions


def get_issue_state_activity(
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
) -> Tuple[Sequence[RuleBase], ConditionFunc, Dict[Dataset, List[str]]]:
    """
    Returns instantiated filter objects, the filter match function, and relevant snuba columns used for answering event filters
    """
    filter_objects = []
    event_columns = defaultdict(list)
    for filter in filters:
        filter_cls = rules.get(filter["id"])
        if filter_cls is None:
            raise PreviewException
        filter_object = filter_cls(project, data=filter)
        filter_objects.append(filter_object)
        try:
            for dataset, columns in filter_object.get_event_columns().items():
                event_columns[dataset].extend(columns)
        except NotImplementedError:
            raise PreviewException

    filter_func = get_match_function(filter_match)
    if filter_func is None:
        raise PreviewException

    return filter_objects, filter_func, event_columns


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


def get_top_groups(
    project: Project, start: datetime, end: datetime, condition_activity: GroupActivityMap
) -> GroupActivityMap:
    """
    Filters the activity to contain only groups that have the most events in the past 2 weeks.

    Since frequency conditions require one snuba query per groups, we need to limit the number groups we process.
    """
    if not condition_activity:
        return condition_activity
    # TODO: Also check other datasets for top groups
    groups = raw_query(
        dataset=Dataset.Events,
        start=start,
        end=end,
        filter_keys={"project_id": [project.id]},
        conditions=[("group_id", "IN", list(condition_activity.keys()))],
        aggregations=[("count", "group_id", "groupCount")],
        groupby=["group_id"],
        order_by="-groupCount",
        seleted_columns=["group_id"],
        limit=FREQUENCY_CONDITION_GROUP_LIMIT,
    ).get("data", [])

    top_groups = {group["group_id"] for group in groups}
    top_activity = {
        group: activity for group, activity in condition_activity.items() if group in top_groups
    }
    return top_activity


def get_events(
    project: Project,
    group_activity: GroupActivityMap,
    columns: Dict[Dataset, List[str]],
) -> Dict[str, Any]:
    """
    Returns events that have caused issue state changes.
    """
    group_ids = defaultdict(list)
    event_ids = defaultdict(list)
    group_categories = Group.objects.filter(id__in=group_activity.keys()).values_list("id", "type")
    category_map = {
        group[0]: GROUP_TYPE_TO_CATEGORY.get(GroupType(group[1])) for group in group_categories
    }
    for group, activities in group_activity.items():
        dataset = GROUP_CATEGORY_TO_DATASET.get(category_map[group], None)
        for activity in activities:
            if activity.type == ConditionActivityType.CREATE_ISSUE:
                group_ids[dataset].append(activity.group_id)
            elif activity.type in (
                ConditionActivityType.REGRESSION,
                ConditionActivityType.REAPPEARED,
            ):
                event_id = activity.data.get("event_id", None)
                if event_id is not None:
                    event_ids[dataset].append(event_id)

            activity.data["dataset"] = dataset

    columns = {k: v + ["event_id"] for k, v in columns.items()}
    events = []

    for dataset, ids in group_ids.items():
        if dataset not in columns:
            continue
        kwargs = {
            "dataset": dataset,
            "filter_keys": {"project_id": [project.id]},
            "conditions": [("group_id", "IN", ids)],
            "orderby": ["group_id", "timestamp"],
            "limitby": (1, "group_id"),
            "selected_columns": columns[dataset] + ["group_id"],
        }
        if dataset.value == Dataset.Transactions.value:
            # this query cannot be made until https://getsentry.atlassian.net/browse/SNS-1891 is fixed
            """
            kwargs["aggregations"] = [("arrayJoin", ["group_ids"], "group_id")]
            kwargs["having"] = kwargs.pop("conditions")
            """
            continue

        events.extend(
            # retrieves the first event for each group
            raw_query(**kwargs).get("data", [])
        )

    if group_ids:
        # store event_ids for CREATE_ISSUE condition activities
        group_map = {event["group_id"]: event["event_id"] for event in events}
        for group, activities in group_activity.items():
            # if there is a CREATE_ISSUE activity, it must be the first
            if activities[0].type == ConditionActivityType.CREATE_ISSUE:
                event_id = group_map.get(group, None)
                if event_id is not None:
                    activities[0].data["event_id"] = event_id

    for dataset, ids in event_ids.items():
        if dataset not in columns:
            continue
        events.extend(
            raw_query(
                dataset=dataset,
                filter_keys={"project_id": [project.id]},
                conditions=[("event_id", "IN", ids)],
                selected_columns=columns[dataset],
            ).get("data", [])
        )

    # the keys and values of tags come in 2 separate lists, pair them up together
    for event in events:
        if "tags.key" in event and "tags.value" in event:
            keys = event.pop("tags.key")
            values = event.pop("tags.value")
            event["tags"] = {k: v for k, v in zip(keys, values)}

    return {event["event_id"]: event for event in events}


def apply_frequency_conditions(
    project: Project,
    start: datetime,
    end: datetime,
    group_activity: GroupActivityMap,
    frequency_conditions: Conditions,
    condition_match: str,
) -> GroupActivityMap:
    """
    Applies frequency conditions to issue state activity.
    """
    conditions = []
    for condition_data in frequency_conditions:
        condition_cls = rules.get(condition_data["id"])
        if condition_cls is None:
            raise PreviewException
        conditions.append(condition_cls(project, data=condition_data))

    filtered_activity = defaultdict(list)
    for group, activities in group_activity.items():
        # TODO: only EventFrequencyCondition is supported right now, so we can reuse the same query
        buckets = get_frequency_buckets(project, start, end, group)
        pass_count = [0] * len(activities)
        for condition in conditions:
            for i, activity in enumerate(activities):
                try:
                    if condition.passes_activity_frequency(activity, buckets):
                        pass_count[i] += 1
                except NotImplementedError:
                    raise PreviewException

        for i in range(len(activities)):
            if (
                pass_count[i]
                and condition_match == "any"
                or pass_count[i] == len(conditions)
                and condition_match == "all"
            ):
                filtered_activity[group].append(activities[i])

    return filtered_activity


def get_frequency_buckets(
    project: Project, start: datetime, end: datetime, group_id: str
) -> Sequence[Dict[str, Any]]:
    """
    Puts the events of a group into buckets, and returns the bucket counts.
    """
    # TODO: support counting of other issue types and fields (# of unique users, ...)
    bucket_counts: Sequence[Dict[str, Any]] = raw_query(
        dataset=Dataset.Events,
        start=start,
        end=end,
        filter_keys={"project_id": [project.id]},
        conditions=[("group_id", "=", group_id)],
        aggregations=[
            ("toStartOfFiveMinute", "timestamp", "roundedTime"),
            ("count", "roundedTime", "bucketCount"),
        ],
        groupby=["roundedTime"],
        orderby=["-roundedTime"],
        selected_columns=["roundedTime", "bucketCount"],
        limit=PREVIEW_TIME_RANGE // FREQUENCY_CONDITION_BUCKET_SIZE + 1,  # at most ~4k
    ).get("data", [])

    for bucket in bucket_counts:
        bucket["roundedTime"] = parse_snuba_datetime(bucket["roundedTime"])
    return bucket_counts


class PreviewException(Exception):
    pass
