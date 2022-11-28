from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Sequence, Tuple

from django.utils import timezone

from sentry.db.models import BaseQuerySet
from sentry.models import Group, Project
from sentry.rules import RuleBase, rules
from sentry.rules.history.preview_strategy import (
    GROUP_CATEGORY_TO_DATASET,
    UPDATE_KWARGS_FOR_GROUP,
    UPDATE_KWARGS_FOR_GROUPS,
)
from sentry.rules.processor import get_match_function
from sentry.snuba.dataset import Dataset
from sentry.types.condition_activity import (
    FREQUENCY_CONDITION_BUCKET_SIZE,
    ConditionActivity,
    ConditionActivityType,
)
from sentry.types.issues import GROUP_TYPE_TO_CATEGORY, GroupType
from sentry.utils.snuba import SnubaQueryParams, bulk_raw_query, parse_snuba_datetime, raw_query

Conditions = Sequence[Dict[str, Any]]
ConditionFunc = Callable[[Sequence[bool]], bool]
GroupActivityMap = Dict[int, List[ConditionActivity]]

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
            event_map = get_events(project, group_activity, event_columns, start, end)

        if frequency_conditions:
            dataset_map = get_group_dataset(group_activity)
            group_activity = apply_frequency_conditions(
                project,
                start,
                end,
                get_top_groups(project, start, end, group_activity, dataset_map),
                frequency_conditions,
                condition_match,
                dataset_map,
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

    for activities in group_activity.values():
        activities.sort(key=lambda a: a.timestamp)

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
) -> Sequence[int]:
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
    project: Project,
    start: datetime,
    end: datetime,
    condition_activity: GroupActivityMap,
    dataset_map: Dict[int, Dataset],
) -> GroupActivityMap:
    """
    Filters the activity to contain only groups that have the most events in the past 2 weeks.

    Since frequency conditions require one snuba query per groups, we need to limit the number groups we process.
    """
    datasets = {dataset_map.get(group) for group in condition_activity.keys()}
    group_ids = list(condition_activity.keys())

    # queries each dataset for top x groups and then gets top x overall
    query_params = []
    for dataset in datasets:
        if dataset not in UPDATE_KWARGS_FOR_GROUPS:
            continue

        kwargs = UPDATE_KWARGS_FOR_GROUPS[dataset](
            group_ids,
            {
                "dataset": dataset,
                "start": start,
                "end": end,
                "filter_keys": {"project_id": [project.id]},
                "aggregations": [("count", "group_id", "groupCount")],
                "groupby": ["group_id"],
                "order_by": "-groupCount",
                "selected_columns": ["group_id", "groupCount"],
                "limit": FREQUENCY_CONDITION_GROUP_LIMIT,
            },
        )
        query_params.append(SnubaQueryParams(**kwargs))

    groups = []
    for result in bulk_raw_query(query_params):
        groups.extend(result.get("data", []))

    sorted_groups = sorted(groups, key=lambda x: int(x["groupCount"]), reverse=True)

    top_groups = {group["group_id"] for group in sorted_groups[:FREQUENCY_CONDITION_GROUP_LIMIT]}
    return {
        group: activity for group, activity in condition_activity.items() if group in top_groups
    }


def get_group_dataset(condition_activity: GroupActivityMap) -> Dict[int, Dataset]:
    """
    Returns a dict that maps each group to its dataset. Assumes each group is mapped to a single dataset.
    If the dataset is not found/supported, it is mapped to None.
    """
    group_categories = Group.objects.filter(id__in=condition_activity.keys()).values_list(
        "id", "type"
    )
    return {
        group[0]: GROUP_CATEGORY_TO_DATASET.get(GROUP_TYPE_TO_CATEGORY.get(GroupType(group[1])))
        for group in group_categories
    }


def get_events(
    project: Project,
    group_activity: GroupActivityMap,
    columns: Dict[Dataset, List[str]],
    start: datetime,
    end: datetime,
) -> Dict[str, Any]:
    """
    Returns events that have caused issue state changes.
    """
    group_ids = defaultdict(list)
    event_ids = defaultdict(list)
    dataset_map = get_group_dataset(group_activity)
    for group, activities in group_activity.items():
        dataset = dataset_map[group]
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

    query_params = []
    # query events by group_id (first event for each group)
    for dataset, ids in group_ids.items():
        if (
            dataset not in columns
            or dataset not in UPDATE_KWARGS_FOR_GROUP
            or dataset == Dataset.Transactions
        ):
            # transaction query cannot be made until https://getsentry.atlassian.net/browse/SNS-1891 is fixed
            continue
        kwargs = UPDATE_KWARGS_FOR_GROUPS[dataset](
            ids,
            {
                "dataset": dataset,
                "start": start,
                "end": end,
                "filter_keys": {"project_id": [project.id]},
                "conditions": [("group_id", "IN", ids)],
                "orderby": ["group_id", "timestamp"],
                "limitby": (1, "group_id"),
                "selected_columns": columns[dataset] + ["group_id"],
            },
        )
        query_params.append(SnubaQueryParams(**kwargs))

    # query events by event_id
    for dataset, ids in event_ids.items():
        if dataset not in columns:
            continue
        query_params.append(
            SnubaQueryParams(
                dataset=dataset,
                start=start,
                end=end,
                filter_keys={"project_id": [project.id]},
                conditions=[("event_id", "IN", ids)],
                selected_columns=columns[dataset],
            )
        )

    group_map = {}
    for result in bulk_raw_query(query_params):
        event_data = result.get("data", [])
        events.extend(event_data)
        for event in event_data:
            if "tags.key" in event and "tags.value" in event:
                # the keys and values of tags come in 2 separate lists, pair them up together
                keys = event.pop("tags.key")
                values = event.pop("tags.value")
                event["tags"] = {k: v for k, v in zip(keys, values)}
            if "group_id" in event:
                group_map[event["group_id"]] = event["event_id"]

    if group_map:
        # store event_ids for CREATE_ISSUE condition activities
        for group, activities in group_activity.items():
            # if there is a CREATE_ISSUE activity, it must be the first
            if activities[0].type == ConditionActivityType.CREATE_ISSUE:
                event_id = group_map.get(group, None)
                if event_id is not None:
                    activities[0].data["event_id"] = event_id

    return {event["event_id"]: event for event in events}


def apply_frequency_conditions(
    project: Project,
    start: datetime,
    end: datetime,
    group_activity: GroupActivityMap,
    frequency_conditions: Conditions,
    condition_match: str,
    dataset_map: Dict[int, Dataset],
) -> GroupActivityMap:
    """
    Applies frequency conditions to issue state activity.
    """
    # TODO: separate the conditions so we can reuse queries for conditions of the same class
    conditions = []
    for condition_data in frequency_conditions:
        condition_cls = rules.get(condition_data["id"])
        if condition_cls is None:
            raise PreviewException
        conditions.append(condition_cls(project, data=condition_data))

    filtered_activity = defaultdict(list)
    for group, activities in group_activity.items():
        # TODO: only EventFrequencyCondition is supported right now, so we can reuse the same query
        buckets = get_frequency_buckets(project, start, end, group, dataset_map[group])
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
    project: Project,
    start: datetime,
    end: datetime,
    group_id: int,
    dataset: Dataset,
) -> Sequence[Dict[str, Any]]:
    """
    Puts the events of a group into buckets, and returns the bucket counts.
    """
    if dataset not in UPDATE_KWARGS_FOR_GROUP:
        return []

    # TODO: support counting of other fields (# of unique users, ...)
    kwargs = UPDATE_KWARGS_FOR_GROUP[dataset](
        group_id,
        {
            "dataset": dataset,
            "start": start,
            "end": end,
            "filter_keys": {"project_id": [project.id]},
            "aggregations": [
                ("toStartOfFiveMinute", "timestamp", "roundedTime"),
                ("count", "roundedTime", "bucketCount"),
            ],
            "groupby": ["roundedTime"],
            "selected_columns": ["roundedTime", "bucketCount"],
            "limit": PREVIEW_TIME_RANGE // FREQUENCY_CONDITION_BUCKET_SIZE + 1,  # at most ~4k
        },
    )

    bucket_counts: Sequence[Dict[str, Any]] = raw_query(**kwargs).get("data", [])

    for bucket in bucket_counts:
        bucket["roundedTime"] = parse_snuba_datetime(bucket["roundedTime"])
    return bucket_counts


class PreviewException(Exception):
    pass
