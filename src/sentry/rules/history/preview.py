from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Sequence
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone

from sentry.issues.grouptype import get_group_type_by_type_id
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.rules import RuleBase, rules
from sentry.rules.history.preview_strategy import (
    DATASET_TO_COLUMN_NAME,
    get_dataset_from_category,
    get_update_kwargs_for_group,
    get_update_kwargs_for_groups,
)
from sentry.rules.processing.processor import get_match_function
from sentry.snuba.dataset import Dataset
from sentry.types.condition_activity import (
    FREQUENCY_CONDITION_BUCKET_SIZE,
    ConditionActivity,
    ConditionActivityType,
    round_to_five_minute,
)
from sentry.utils.snuba import SnubaQueryParams, bulk_raw_query, parse_snuba_datetime, raw_query

Conditions = Sequence[dict[str, Any]]
ConditionFunc = Callable[[Sequence[bool]], bool]
GroupActivityMap = dict[int, list[ConditionActivity]]

PREVIEW_TIME_RANGE = timedelta(weeks=2)
# limit on number of ConditionActivity's a condition will return
# if limited, conditions should return the latest activity
CONDITION_ACTIVITY_LIMIT = 1000
FREQUENCY_CONDITION_GROUP_LIMIT = 10
ISSUE_STATE_CONDITIONS = [
    "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
    "sentry.rules.conditions.regression_event.RegressionEventCondition",
    "sentry.rules.conditions.reappeared_event.ReappearedEventCondition",
    "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition",
    "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition",
]
FREQUENCY_CONDITIONS = [
    "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
    "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition",
    "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
]

# Most of the ISSUE_STATE_CONDITIONS are mutually exclusive, except for the following pairs.
VALID_CONDITION_PAIRS = {
    "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition": "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition",
    "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
    "sentry.rules.conditions.reappeared_event.ReappearedEventCondition": "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition",
    "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition",
}


def preview(
    project: Project,
    conditions: Conditions,
    filters: Conditions,
    condition_match: str,
    filter_match: str,
    frequency_minutes: int,
    end: datetime | None = None,
) -> dict[int, datetime] | None:
    """
    Returns groups that would have triggered the given conditions and filters in the past 2 weeks
    """
    issue_state_conditions, frequency_conditions = categorize_conditions(conditions)
    # must have at least one condition to filter activity
    if not issue_state_conditions and not frequency_conditions:
        return None
    elif len(issue_state_conditions) > 1 and condition_match == "all":
        # Of the supported conditions, any more than two would be mutually exclusive
        if len(issue_state_conditions) > 2:
            return {}

        condition_ids = {condition["id"] for condition in issue_state_conditions}

        # all the issue state conditions are mutually exclusive
        if not any(condition in VALID_CONDITION_PAIRS for condition in condition_ids):
            return {}

        # if there are multiple issue state conditions, they must be one of the valid pairs
        for condition in condition_ids:
            if (
                condition in VALID_CONDITION_PAIRS
                and VALID_CONDITION_PAIRS[condition] not in condition_ids
            ):
                return {}

    if end is None:
        end = timezone.now()
    start = end - PREVIEW_TIME_RANGE
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
            dataset_map = get_group_dataset(list(group_activity.keys()))
            has_issue_state_condition = bool(issue_state_conditions)
            group_activity = apply_frequency_conditions(
                project,
                start,
                end,
                get_top_groups(
                    project, start, end, group_activity, dataset_map, has_issue_state_condition
                ),
                frequency_conditions,
                condition_match,
                dataset_map,
                has_issue_state_condition,
            )

        frequency = timedelta(minutes=frequency_minutes)
        group_fires = get_fired_groups(
            group_activity, filter_objects, filter_func, start, frequency, event_map
        )
        return group_fires
    except PreviewException:
        return None


def categorize_conditions(conditions: Conditions) -> tuple[Conditions, Conditions]:
    """
    Categorizes conditions into issue state conditions or frequency conditions.
    These two types of conditions are processed separately.

    Also deduplicates conditions, mainly for issue state conditions since they don't have params
    so there can be at most 3, and some of the preview logic after assumes they are unique.
    """
    issue_state_conditions = set()
    frequency_conditions = []
    for condition in conditions:
        condition_id = condition["id"]
        if condition_id in ISSUE_STATE_CONDITIONS:
            issue_state_conditions.add(condition_id)
        elif condition_id in FREQUENCY_CONDITIONS:
            frequency_conditions.append(condition)
        else:
            return [], []
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
        condition_inst = condition_cls(project=project, data=condition)
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
) -> tuple[Sequence[RuleBase], ConditionFunc, dict[Dataset, list[str]]]:
    """
    Returns instantiated filter objects, the filter match function, and relevant snuba columns used for answering event filters
    """
    filter_objects = []
    event_columns: dict[Dataset, list[str]] = defaultdict(list)
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
    event_map: dict[str, Any],
) -> dict[int, datetime]:
    """
    Applies filter objects to the condition activity.
    Returns the group ids of activities that pass the filters and the last fire of each group
    """
    group_fires = {}
    for group, activities in group_activity.items():
        last_fire = start - frequency
        for event in activities:
            try:
                passes = [f.passes_activity(event, event_map) for f in filter_objects]
            except NotImplementedError:
                raise PreviewException
            if last_fire <= event.timestamp - frequency and filter_func(passes):
                group_fires[group] = event.timestamp
                last_fire = event.timestamp

    return group_fires


def get_top_groups(
    project: Project,
    start: datetime,
    end: datetime,
    condition_activity: GroupActivityMap,
    dataset_map: dict[int, Dataset],
    has_issue_state_condition: bool = True,
) -> GroupActivityMap:
    """
    Filters the activity to contain only groups that have the most events (out of the given groups) in the past 2 weeks.
    If no groups are provided because there are no issue state change conditions, returns the top groups overall.

    Since frequency conditions require snuba query(s), we need to limit the number groups we process.
    """
    if has_issue_state_condition:
        datasets = {dataset_map.get(group) for group in condition_activity.keys()}
    else:
        # condition_activity will be empty because there are no issue state conditions.
        # So, we look to find top groups over all datasets
        datasets = set(DATASET_TO_COLUMN_NAME.keys())
    group_ids = list(condition_activity.keys())

    # queries each dataset for top x groups and then gets top x overall
    query_params = []
    for dataset in datasets:
        kwargs = get_update_kwargs_for_groups(
            dataset,
            group_ids,
            {
                "dataset": dataset,
                "start": start,
                "end": end,
                "filter_keys": {"project_id": [project.id]},
                "aggregations": [("count", "group_id", "groupCount")],
                "groupby": ["group_id"],
                "orderby": "-groupCount",
                "selected_columns": ["group_id", "groupCount"],
                "limit": FREQUENCY_CONDITION_GROUP_LIMIT,
            },
            has_issue_state_condition,
        )
        query_params.append(
            SnubaQueryParams(**kwargs, tenant_ids={"organization_id": project.organization_id})
        )

    groups = []
    for result in bulk_raw_query(query_params, use_cache=True, referrer="preview.get_top_groups"):
        groups.extend(result.get("data", []))

    top_groups = sorted(groups, key=lambda x: int(x["groupCount"]), reverse=True)[
        :FREQUENCY_CONDITION_GROUP_LIMIT
    ]
    if not has_issue_state_condition:
        # dataset_map should be empty here since there are no groups. Update with new overall top groups
        dataset_map.update(get_group_dataset([group["group_id"] for group in top_groups]))

    return {
        group["group_id"]: condition_activity.get(group["group_id"], []) for group in top_groups
    }


def get_group_dataset(group_ids: Sequence[int]) -> dict[int, Dataset]:
    """
    Returns a dict that maps each group to its dataset. Assumes each group is mapped to a single dataset.
    If the dataset is not found/supported, it is mapped to None.
    """
    group_categories = list(Group.objects.filter(id__in=group_ids).values_list("id", "type"))
    if not group_categories:
        return {}
    org = Organization.objects.get(project__group__id=group_categories[0][0])

    return {
        group_id: get_dataset_from_category(get_group_type_by_type_id(group_type).category, org)
        for group_id, group_type in group_categories
    }


def get_events(
    project: Project,
    group_activity: GroupActivityMap,
    columns: dict[Dataset, list[str]],
    start: datetime,
    end: datetime,
) -> dict[str, Any]:
    """
    Returns events that have caused issue state changes.
    """
    group_ids = defaultdict(list)
    event_ids = defaultdict(list)
    dataset_map = get_group_dataset(list(group_activity.keys()))
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
    tenant_ids = {"organization_id": project.organization_id}
    # query events by group_id (first event for each group)
    for dataset, ids in group_ids.items():
        if dataset not in columns or dataset == Dataset.Transactions:
            # transaction query cannot be made until https://getsentry.atlassian.net/browse/SNS-1891 is fixed
            continue
        kwargs = get_update_kwargs_for_groups(
            dataset,
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
        query_params.append(SnubaQueryParams(**kwargs, tenant_ids=tenant_ids))

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
                tenant_ids=tenant_ids,
            )
        )

    group_map = {}
    for result in bulk_raw_query(query_params, use_cache=True, referrer="preview.get_events"):
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
    dataset_map: dict[int, Dataset],
    has_issue_state_condition: bool,
) -> GroupActivityMap:
    """
    Applies frequency conditions to issue state activity.
    """
    condition_types = defaultdict(list)
    for condition_data in frequency_conditions:
        condition_cls = rules.get(condition_data["id"])
        if condition_cls is None:
            raise PreviewException
        condition_types[condition_data["id"]].append(
            condition_cls(project=project, data=condition_data)
        )

    filtered_activity = defaultdict(list)
    if condition_match == "all":
        for group, activities in group_activity.items():
            init_activities_from_freq_cond = False
            passes = [True] * len(activities)
            for conditions in condition_types.values():
                # reuse frequency buckets for conditions of the same type
                try:
                    buckets = get_frequency_buckets(
                        project,
                        start,
                        end,
                        group,
                        dataset_map[group],
                        conditions[0].get_preview_aggregate(),
                    )
                except NotImplementedError:
                    raise PreviewException
                skip_first = False
                if not has_issue_state_condition and not init_activities_from_freq_cond:
                    # If there are no issue state change conditions, then we won't have any initial activities
                    # to base our frequency condition queries off of. Instead, we take the first frequency condition and
                    # create the initial activities from that
                    init_activities_from_freq_cond = skip_first = True
                    for bucket_time in buckets.keys():
                        activity = ConditionActivity(
                            group,
                            ConditionActivityType.FREQUENCY_CONDITION,
                            bucket_time,
                        )
                        try:
                            if conditions[0].passes_activity_frequency(activity, buckets):
                                activities.append(activity)
                        except NotImplementedError:
                            raise PreviewException

                    # recreate passes array
                    passes = [True] * len(activities)

                for condition in conditions[1:] if skip_first else conditions:
                    for i, activity in enumerate(activities):
                        try:
                            if passes[i] and not condition.passes_activity_frequency(
                                activity, buckets
                            ):
                                passes[i] = False
                        except NotImplementedError:
                            raise PreviewException

            filtered_activity[group] = [activities[i] for i in range(len(activities)) if passes[i]]

        return filtered_activity
    elif condition_match == "any":
        # Find buckets that pass at least one condition, and create condition activity from it
        for group, activities in group_activity.items():
            pass_buckets = set()
            for conditions in condition_types.values():
                try:
                    buckets = get_frequency_buckets(
                        project,
                        start,
                        end,
                        group,
                        dataset_map[group],
                        conditions[0].get_preview_aggregate(),
                    )
                except NotImplementedError:
                    raise PreviewException
                for condition in conditions:
                    for bucket_time in buckets.keys():
                        activity = ConditionActivity(
                            group,
                            ConditionActivityType.FREQUENCY_CONDITION,
                            bucket_time,
                        )
                        try:
                            if condition.passes_activity_frequency(activity, buckets):
                                pass_buckets.add(activity.timestamp)
                        except NotImplementedError:
                            raise PreviewException

            for bucket in pass_buckets:
                activities.append(
                    ConditionActivity(group, ConditionActivityType.FREQUENCY_CONDITION, bucket)
                )
            k = lambda a: a.timestamp
            activities.sort(key=k)

        return group_activity
    return {}


def get_frequency_buckets(
    project: Project,
    start: datetime,
    end: datetime,
    group_id: int,
    dataset: Dataset,
    aggregate: tuple[str, str],
) -> dict[datetime, int]:
    """
    Puts the events of a group into buckets, and returns the bucket counts.
    """
    kwargs = get_update_kwargs_for_group(
        dataset,
        group_id,
        {
            "dataset": dataset,
            "start": start,
            "end": end,
            "filter_keys": {"project_id": [project.id]},
            "aggregations": [
                ("toStartOfFiveMinute", "timestamp", "roundedTime"),
                (*aggregate, "bucketCount"),
            ],
            "orderby": ["-roundedTime"],
            "groupby": ["roundedTime"],
            "selected_columns": ["roundedTime", "bucketCount"],
            "limit": PREVIEW_TIME_RANGE // FREQUENCY_CONDITION_BUCKET_SIZE + 1,  # at most ~4k
        },
    )
    bucket_counts = raw_query(
        **kwargs,
        use_cache=True,
        referrer="preview.get_frequency_buckets",
        tenant_ids={"organization_id": project.organization_id},
    ).get("data", [])

    for bucket in bucket_counts:
        bucket["roundedTime"] = parse_snuba_datetime(bucket["roundedTime"])

    rounded_time = round_to_five_minute(start)
    rounded_end = round_to_five_minute(end)
    cumulative_sum = 0
    buckets = {}
    # the query result only contains buckets that have a positive count
    # here we fill in the empty buckets and accumulate the sum
    while rounded_time <= rounded_end:
        if bucket_counts and bucket_counts[-1]["roundedTime"] == rounded_time:
            cumulative_sum += bucket_counts.pop()["bucketCount"]
        buckets[rounded_time] = cumulative_sum
        rounded_time += FREQUENCY_CONDITION_BUCKET_SIZE

    return buckets


class PreviewException(Exception):
    pass
