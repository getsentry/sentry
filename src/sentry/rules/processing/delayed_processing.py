import logging
import math
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, DefaultDict, NamedTuple

import sentry_sdk

from sentry import buffer, nodestore
from sentry.buffer.redis import BufferHookEvent, redis_buffer_registry
from sentry.eventstore.models import Event, GroupEvent
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.grouprulestatus import GroupRuleStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.models.rulesnooze import RuleSnooze
from sentry.rules import history, rules
from sentry.rules.conditions.event_frequency import (
    COMPARISON_INTERVALS,
    DEFAULT_COMPARISON_INTERVAL,
    BaseEventFrequencyCondition,
    ComparisonType,
    EventFrequencyConditionData,
    percent_increase,
)
from sentry.rules.processing.processor import (
    PROJECT_ID_BUFFER_LIST_KEY,
    activate_downstream_actions,
    bulk_get_rule_status,
    is_condition_slow,
    split_conditions_and_filters,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.tasks.post_process import should_retry_fetch
from sentry.utils import json, metrics
from sentry.utils.iterators import chunked
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.rules.delayed_processing")
EVENT_LIMIT = 100


class UniqueConditionQuery(NamedTuple):
    """
    Represents all the data that uniquely identifies a condition class and its
    single respective Snuba query that must be made. Multiple instances of the
    same condition class can share the single query.
    """

    cls_id: str
    interval: str
    environment_id: int
    comparison_interval: str | None = None

    def __repr__(self):
        return f"id: {self.cls_id},\ninterval: {self.interval},\nenv id: {self.environment_id},\ncomp interval: {self.comparison_interval}"


class DataAndGroups(NamedTuple):
    data: EventFrequencyConditionData
    group_ids: set[int]

    def __repr__(self):
        return f"data: {self.data}\ngroup_ids: {self.group_ids}"


def get_slow_conditions(rule: Rule) -> list[EventFrequencyConditionData]:
    """
    Returns the slow conditions of a rule model instance.
    """
    conditions_and_filters = rule.data.get("conditions", ())
    conditions, _ = split_conditions_and_filters(conditions_and_filters)
    slow_conditions = [cond for cond in conditions if is_condition_slow(cond)]

    # MyPy refuses to make TypedDict compatible with MutableMapping
    # https://github.com/python/mypy/issues/4976
    return slow_conditions  # type: ignore[return-value]


def get_rules_to_groups(rulegroup_to_event_data: dict[str, str]) -> DefaultDict[int, set[int]]:
    rules_to_groups: DefaultDict[int, set[int]] = defaultdict(set)
    for rule_group in rulegroup_to_event_data:
        rule_id, group_id = rule_group.split(":")
        rules_to_groups[int(rule_id)].add(int(group_id))

    return rules_to_groups


def get_rules_to_slow_conditions(
    alert_rules: list[Rule],
) -> DefaultDict[Rule, list[EventFrequencyConditionData]]:
    rules_to_slow_conditions: DefaultDict[Rule, list[EventFrequencyConditionData]] = defaultdict(
        list
    )
    for rule in alert_rules:
        slow_conditions = get_slow_conditions(rule)
        for condition_data in slow_conditions:
            rules_to_slow_conditions[rule].append(condition_data)

    return rules_to_slow_conditions


def generate_unique_queries(
    condition_data: EventFrequencyConditionData, environment_id: int
) -> list[UniqueConditionQuery]:
    """
    Returns a list of all unique condition queries that must be made for the
    given condition instance.
    Count comparison conditions will only have one unique query, while percent
    comparison conditions will have two unique queries.
    """
    unique_queries = [
        UniqueConditionQuery(
            cls_id=condition_data["id"],
            interval=condition_data["interval"],
            environment_id=environment_id,
        )
    ]
    if condition_data.get("comparisonType") == ComparisonType.PERCENT:
        # We will later compare the first query results against the second query to calculate
        # a percentage for percentage comparison conditions.
        comparison_interval = condition_data.get("comparisonInterval", DEFAULT_COMPARISON_INTERVAL)
        second_query_data = unique_queries[0]._asdict()
        second_query_data["comparison_interval"] = comparison_interval
        unique_queries.append(UniqueConditionQuery(**second_query_data))

    return unique_queries


def get_condition_query_groups(
    alert_rules: list[Rule], rules_to_groups: DefaultDict[int, set[int]]
) -> dict[UniqueConditionQuery, DataAndGroups]:
    """
    Map unique condition queries to the group IDs that need to checked for that
    query. We also store a pointer to that condition's JSON so we can
    instantiate the class later.
    """
    condition_groups: dict[UniqueConditionQuery, DataAndGroups] = {}
    for rule in alert_rules:
        # We only want a rule's slow conditions because alert_rules are only added
        # to the buffer if we've already checked their fast conditions.
        slow_conditions = get_slow_conditions(rule)
        for condition_data in slow_conditions:
            for condition_query in generate_unique_queries(condition_data, rule.environment_id):
                # NOTE: If percent and count comparison conditions are sharing
                # the same UniqueConditionQuery, the condition JSON in
                # DataAndGroups will be incorrect for one of those types.
                # The JSON will either have or be missing a comparisonInterval
                # which only applies to percent conditions, and have the incorrect
                # comparisonType for one type. This is not a concern because
                # when we instantiate the exact condition class with the JSON,
                # the class ignores both fields when calling get_rate_bulk.

                # Add to set of group_ids if there are already group_ids
                # that apply to the unique condition query.
                if data_and_groups := condition_groups.get(condition_query):
                    data_and_groups.group_ids.update(rules_to_groups[rule.id])
                # Otherwise, create the tuple containing the condition data and the
                # set of group_ids that apply to the unique condition query.
                else:
                    condition_groups[condition_query] = DataAndGroups(
                        condition_data, set(rules_to_groups[rule.id])
                    )
    return condition_groups


def get_condition_group_results(
    condition_groups: dict[UniqueConditionQuery, DataAndGroups],
    project: Project,
) -> dict[UniqueConditionQuery, dict[int, int]] | None:
    condition_group_results: dict[UniqueConditionQuery, dict[int, int]] = {}
    current_time = datetime.now(tz=timezone.utc)
    for unique_condition, (condition_data, group_ids) in condition_groups.items():
        condition_cls = rules.get(unique_condition.cls_id)

        if condition_cls is None:
            logger.warning(
                "Unregistered condition %r",
                unique_condition.cls_id,
                extra={"project_id": project.id},
            )
            continue

        # MyPy refuses to make TypedDict compatible with MutableMapping
        # https://github.com/python/mypy/issues/4976
        condition_inst = condition_cls(project=project, data=condition_data)  # type: ignore[arg-type]
        if not isinstance(condition_inst, BaseEventFrequencyCondition):
            logger.warning(
                "Unregistered condition %r",
                condition_cls.id,
                extra={"project_id": project.id},
            )
            continue

        _, duration = condition_inst.intervals[unique_condition.interval]

        # The comparison interval is only set for the second query of a percent
        # comparison condition.
        comparison_interval = (
            COMPARISON_INTERVALS[unique_condition.comparison_interval][1]
            if unique_condition.comparison_interval
            else None
        )

        result = safe_execute(
            condition_inst.get_rate_bulk,
            duration=duration,
            group_ids=group_ids,
            environment_id=unique_condition.environment_id,
            current_time=current_time,
            comparison_interval=comparison_interval,
        )
        condition_group_results[unique_condition] = result or {}
    return condition_group_results


def _passes_comparison(
    condition_group_results: dict[UniqueConditionQuery, dict[int, int]],
    condition_data: EventFrequencyConditionData,
    group_id: int,
    environment_id: int,
    project_id: int,
) -> bool:
    """
    Checks if a specific condition instance has passed. Handles both the count
    and percent comparison type conditions.
    """
    unique_queries = generate_unique_queries(condition_data, environment_id)
    try:
        query_values = [
            condition_group_results[unique_query][group_id] for unique_query in unique_queries
        ]
    except KeyError as exception:
        sentry_sdk.capture_exception(exception)
        logger.exception(
            "delayed_processing.missing_query_results",
            extra={"exception": exception, "group_id": group_id, "project_id": project_id},
        )
        return False

    calculated_value = query_values[0]
    # If there's a second query we must have a percent comparison condition.
    if len(query_values) == 2:
        calculated_value = percent_increase(calculated_value, query_values[1])

    target_value = float(condition_data["value"])

    return calculated_value > target_value


def get_rules_to_fire(
    condition_group_results: dict[UniqueConditionQuery, dict[int, int]],
    rules_to_slow_conditions: DefaultDict[Rule, list[EventFrequencyConditionData]],
    rules_to_groups: DefaultDict[int, set[int]],
    project_id: int,
) -> DefaultDict[Rule, set[int]]:
    rules_to_fire = defaultdict(set)
    for alert_rule, slow_conditions in rules_to_slow_conditions.items():
        action_match = alert_rule.data.get("action_match", "any")
        for group_id in rules_to_groups[alert_rule.id]:
            conditions_matched = 0
            for slow_condition in slow_conditions:
                if _passes_comparison(
                    condition_group_results,
                    slow_condition,
                    group_id,
                    alert_rule.environment_id,
                    project_id,
                ):
                    if action_match == "any":
                        rules_to_fire[alert_rule].add(group_id)
                        break
                    elif action_match == "all":
                        conditions_matched += 1
            if action_match == "all" and conditions_matched == len(slow_conditions):
                rules_to_fire[alert_rule].add(group_id)
    return rules_to_fire


def parse_rulegroup_to_event_data(
    rulegroup_to_event_data: dict[str, str]
) -> dict[tuple[str, str], dict[str, str]]:
    parsed_rulegroup_to_event_data: dict[tuple[str, str], dict[str, str]] = {}

    for rule_group, instance_data in rulegroup_to_event_data.items():
        event_data = json.loads(instance_data)
        rule_id, group_id = rule_group.split(":")
        parsed_rulegroup_to_event_data[(rule_id, group_id)] = event_data
    return parsed_rulegroup_to_event_data


def bulk_fetch_events(event_ids: list[str], project_id: int) -> dict[str, Event]:
    node_id_to_event_id: dict[str, str] = {
        Event.generate_node_id(project_id, event_id=event_id): event_id for event_id in event_ids
    }
    node_ids = list(node_id_to_event_id.keys())
    fetch_retry_policy = ConditionalRetryPolicy(should_retry_fetch, exponential_delay(1.00))

    bulk_data = {}
    for node_id_chunk in chunked(node_ids, EVENT_LIMIT):
        bulk_results = fetch_retry_policy(lambda: nodestore.backend.get_multi(node_id_chunk))
        bulk_data.update(bulk_results)

    bulk_event_id_to_events: dict[str, Event] = {}
    for node_id, data in bulk_data.items():
        event_id = node_id_to_event_id[node_id]
        if data is not None:
            event = Event(event_id=event_id, project_id=project_id, data=data)
            bulk_event_id_to_events[event_id] = event

    return bulk_event_id_to_events


def build_group_to_groupevent(
    parsed_rulegroup_to_event_data: dict[tuple[str, str], dict[str, str]],
    bulk_event_id_to_events: dict[str, Event],
    bulk_occurrence_id_to_occurrence: dict[str, IssueOccurrence],
    group_id_to_group: dict[int, Group],
    project_id: int,
) -> dict[Group, GroupEvent]:
    group_to_groupevent: dict[Group, GroupEvent] = {}

    for rule_group, instance_data in parsed_rulegroup_to_event_data.items():
        event_id = instance_data.get("event_id")
        occurrence_id = instance_data.get("occurrence_id")
        occurrence = None

        if event_id:
            event = bulk_event_id_to_events.get(event_id)
        else:
            logger.info(
                "delayed_processing.missing_event_id",
                extra={"rule": rule_group[0], "project_id": project_id},
            )

        group = group_id_to_group.get(int(rule_group[1]))
        if not group or not event:
            extra = {"rule": rule_group[0], "project_id": project_id}
            if not group:
                logger.info("delayed_processing.missing_group", extra=extra)
            if not event:
                if group:
                    extra["group_id"] = group.id

                logger.info(
                    "delayed_processing.missing_event",
                    extra=extra,
                )
            continue

        group_event = event.for_group(group)
        if occurrence_id:
            occurrence = bulk_occurrence_id_to_occurrence.get(occurrence_id)
        group_event.occurrence = occurrence
        group_to_groupevent[group] = group_event

    return group_to_groupevent


def get_group_to_groupevent(
    parsed_rulegroup_to_event_data: dict[tuple[str, str], dict[str, str]],
    project_id: int,
    group_ids: set[int],
) -> dict[Group, GroupEvent]:
    groups = Group.objects.filter(id__in=group_ids)
    group_id_to_group = {group.id: group for group in groups}
    event_ids: set[str] = set()
    occurrence_ids: list[str] = []

    for instance_data in parsed_rulegroup_to_event_data.values():
        event_id = instance_data.get("event_id")
        if event_id:
            event_ids.add(event_id)
        occurrence_id = instance_data.get("occurrence_id")
        if occurrence_id:
            occurrence_ids.append(occurrence_id)

    bulk_event_id_to_events = bulk_fetch_events(list(event_ids), project_id)
    bulk_occurrences = IssueOccurrence.fetch_multi(occurrence_ids, project_id=project_id)
    bulk_occurrence_id_to_occurrence = {
        occurrence.id: occurrence for occurrence in bulk_occurrences if occurrence
    }
    return build_group_to_groupevent(
        parsed_rulegroup_to_event_data,
        bulk_event_id_to_events,
        bulk_occurrence_id_to_occurrence,
        group_id_to_group,
        project_id,
    )


def bucket_num_groups(num_groups: int) -> str:
    if num_groups > 1:
        magnitude = 10 ** int(math.log10(num_groups))
        return f">{magnitude}"
    return "1"


def process_delayed_alert_conditions() -> None:
    with metrics.timer("delayed_processing.process_all_conditions.duration"):
        fetch_time = datetime.now(tz=timezone.utc)
        project_ids = buffer.backend.get_sorted_set(
            PROJECT_ID_BUFFER_LIST_KEY, min=0, max=fetch_time.timestamp()
        )
        log_str = ""
        for project_id, timestamp in project_ids:
            log_str += f"{project_id}: {timestamp}"
        logger.info("delayed_processing.project_id_list", extra={"project_ids": log_str})

        for project_id, _ in project_ids:
            apply_delayed.delay(project_id)

        buffer.backend.delete_key(PROJECT_ID_BUFFER_LIST_KEY, min=0, max=fetch_time.timestamp())


@instrumented_task(
    name="sentry.rules.processing.delayed_processing",
    queue="delayed_rules",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=50,
    time_limit=60,  # 1 minute
    silo_mode=SiloMode.REGION,
)
def apply_delayed(project_id: int, *args: Any, **kwargs: Any) -> None:
    """
    Grab rules, groups, and events from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """
    # STEP 1: Fetch the rulegroup_to_event_data mapping for the project from redis
    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        # The TTL of the buffer is 1 hr so the rule_group to event data for the
        # nonexistent project will eventually be cleaned up.
        logger.info(
            "delayed_processing.project_does_not_exist",
            extra={"project_id": project_id},
        )
        return
    rulegroup_to_event_data = buffer.backend.get_hash(
        model=Project, field={"project_id": project.id}
    )
    num_groups = len(rulegroup_to_event_data.keys())
    num_groups_bucketed = bucket_num_groups(num_groups)
    metrics.incr("delayed_processing.num_groups", tags={"num_groups": num_groups_bucketed})
    logger.info(
        "delayed_processing.rulegroupeventdata",
        extra={"rulegroupdata": rulegroup_to_event_data, "project_id": project_id},
    )

    # STEP 2: Map each rule to the groups that must be checked for that rule.
    rules_to_groups = get_rules_to_groups(rulegroup_to_event_data)

    # STEP 3: Fetch the Rule models we need to check
    alert_rules_qs = Rule.objects.filter(id__in=list(rules_to_groups.keys()))
    snoozed_rules = set(
        RuleSnooze.objects.filter(rule__in=alert_rules_qs, user_id=None).values_list(
            "rule", flat=True
        )
    )
    alert_rules = [rule for rule in alert_rules_qs if rule.id not in snoozed_rules]

    # STEP 4: Create a map of unique condition queries to a tuple containing the
    # JSON information needed to instantiate that condition class and the
    # group_ids that must be checked for that condition.
    # We don't query per rule condition because conditions of the same class,
    # interval, environment, and comparison_interval can share a single scan.
    condition_groups = get_condition_query_groups(alert_rules, rules_to_groups)
    logger.info(
        "delayed_processing.condition_groups",
        extra={"condition_groups": condition_groups, "project_id": project_id},
    )

    # Step 5: Instantiate the condition that we can apply to each unique condition
    # query, and evaluate the relevant group_ids that apply for that query.
    with metrics.timer("delayed_processing.get_condition_group_results.duration"):
        condition_group_results = get_condition_group_results(condition_groups, project)

    # Step 6: For each rule and group applying to that rule, check if the group
    # meets the conditions of the rule (basically doing BaseEventFrequencyCondition.passes)
    rules_to_slow_conditions = get_rules_to_slow_conditions(alert_rules)
    rules_to_fire = defaultdict(set)
    if condition_group_results:
        rules_to_fire = get_rules_to_fire(
            condition_group_results, rules_to_slow_conditions, rules_to_groups, project_id
        )
        log_str = ""
        for rule in rules_to_fire.keys():
            log_str += f"{str(rule.id)}, "
        logger.info(
            "delayed_processing.rule_to_fire",
            extra={"rules_to_fire": log_str, "project_id": project_id},
        )

    # Step 7: Fire the rule's actions
    now = datetime.now(tz=timezone.utc)
    parsed_rulegroup_to_event_data = parse_rulegroup_to_event_data(rulegroup_to_event_data)
    with metrics.timer("delayed_processing.fire_rules.duration"):
        for rule, group_ids in rules_to_fire.items():
            frequency = rule.data.get("frequency") or Rule.DEFAULT_FREQUENCY
            freq_offset = now - timedelta(minutes=frequency)
            group_to_groupevent = get_group_to_groupevent(
                parsed_rulegroup_to_event_data, project.id, group_ids
            )
            for group, groupevent in group_to_groupevent.items():
                rule_statuses = bulk_get_rule_status(alert_rules, group, project)
                status = rule_statuses[rule.id]
                if status.last_active and status.last_active > freq_offset:
                    logger.info(
                        "delayed_processing.last_active",
                        extra={
                            "last_active": status.last_active,
                            "freq_offset": freq_offset,
                            "project_id": project_id,
                            "group_id": group.id,
                        },
                    )
                    break

                updated = (
                    GroupRuleStatus.objects.filter(id=status.id)
                    .exclude(last_active__gt=freq_offset)
                    .update(last_active=now)
                )

                if not updated:
                    logger.info(
                        "delayed_processing.not_updated",
                        extra={
                            "status_id": status.id,
                            "project_id": project_id,
                            "group_id": group.id,
                        },
                    )
                    break

                notification_uuid = str(uuid.uuid4())
                groupevent = group_to_groupevent[group]
                rule_fire_history = history.record(
                    rule, group, groupevent.event_id, notification_uuid
                )
                for callback, futures in activate_downstream_actions(
                    rule, groupevent, notification_uuid, rule_fire_history
                ).values():
                    safe_execute(callback, groupevent, futures)

    # Step 8: Clean up Redis buffer data
    hashes_to_delete = [
        f"{rule}:{group}" for rule, groups in rules_to_groups.items() for group in groups
    ]
    buffer.backend.delete_hash(
        model=Project,
        filters={"project_id": project_id},
        fields=hashes_to_delete,
    )


if not redis_buffer_registry.has(BufferHookEvent.FLUSH):
    redis_buffer_registry.add_handler(BufferHookEvent.FLUSH, process_delayed_alert_conditions)
