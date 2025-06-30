import logging
import random
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, DefaultDict, NamedTuple

import sentry_sdk
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from django.db.models import OuterRef, Subquery

from sentry import buffer, features, nodestore
from sentry.buffer.base import BufferField
from sentry.db import models
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
from sentry.rules.processing.buffer_processing import (
    BufferHashKeys,
    DelayedProcessingBase,
    FilterKeys,
    delayed_processing_registry,
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
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import issues_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import json, metrics
from sentry.utils.iterators import chunked
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.utils.safe import safe_execute
from sentry.workflow_engine.processors.log_util import track_batch_performance

logger = logging.getLogger("sentry.rules.delayed_processing")
EVENT_LIMIT = 100
COMPARISON_INTERVALS_VALUES = {k: v[1] for k, v in COMPARISON_INTERVALS.items()}


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
        return (
            f"<UniqueConditionQuery:\nid: {self.cls_id},\ninterval: {self.interval},\nenv id: {self.environment_id},\n"
            f"comp interval: {self.comparison_interval}\n>"
        )


class DataAndGroups(NamedTuple):
    data: EventFrequencyConditionData
    group_ids: set[int]
    rule_id: int | None = None

    def __repr__(self):
        return (
            f"<DataAndGroups data: {self.data} group_ids: {self.group_ids} rule_id: {self.rule_id}>"
        )


def fetch_project(project_id: int) -> Project | None:
    try:
        return Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.info(
            "delayed_processing.project_does_not_exist",
            extra={"project_id": project_id},
        )
        return None


# TODO: replace with fetch_group_to_event_data
def fetch_rulegroup_to_event_data(project_id: int, batch_key: str | None = None) -> dict[str, str]:
    field: dict[str, models.Model | int | str] = {
        "project_id": project_id,
    }

    if batch_key:
        field["batch_key"] = batch_key

    return buffer.backend.get_hash(model=Project, field=field)


def get_rules_to_groups(rulegroup_to_event_data: dict[str, str]) -> DefaultDict[int, set[int]]:
    rules_to_groups: DefaultDict[int, set[int]] = defaultdict(set)
    for rule_group in rulegroup_to_event_data:
        rule_id, group_id = map(int, rule_group.split(":"))
        rules_to_groups[rule_id].add(group_id)
    return rules_to_groups


def fetch_alert_rules(rule_ids: list[int]) -> list[Rule]:
    return list(
        Rule.objects.filter(id__in=rule_ids).exclude(
            id__in=Subquery(
                RuleSnooze.objects.filter(rule_id=OuterRef("id"), user_id=None).values("rule_id")
            )
        )
    )


def get_slow_conditions(rule: Rule) -> list[EventFrequencyConditionData]:
    conditions_and_filters = rule.data.get("conditions", ())
    conditions, _ = split_conditions_and_filters(conditions_and_filters)
    slow_conditions = [cond for cond in conditions if is_condition_slow(cond)]
    return slow_conditions  # type: ignore[return-value]


@dataclass(frozen=True)
class LogConfig:
    """
    LogConfig efficiently caches the results of features.has calls; these are project/org
    based, should be stable within our task, and caching them helps avoid generating
    excessive spans and saves a bit of time.
    """

    # Cached value of features.has("projects:num-events-issue-debugging", project)
    num_events_issue_debugging: bool
    # Cached value of features.has("organizations:workflow-engine-process-workflows", organization)
    workflow_engine_process_workflows: bool

    @classmethod
    def create(cls, project: Project) -> "LogConfig":
        return cls(
            num_events_issue_debugging=features.has("projects:num-events-issue-debugging", project),
            workflow_engine_process_workflows=features.has(
                "organizations:workflow-engine-process-workflows", project.organization
            ),
        )


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
                else:
                    condition_groups[condition_query] = DataAndGroups(
                        condition_data, set(rules_to_groups[rule.id]), rule.id
                    )
    return condition_groups


def bulk_fetch_events(event_ids: list[str], project_id: int) -> dict[str, Event]:
    node_id_to_event_id = {
        Event.generate_node_id(project_id, event_id=event_id): event_id for event_id in event_ids
    }
    node_ids = list(node_id_to_event_id.keys())
    fetch_retry_policy = ConditionalRetryPolicy(should_retry_fetch, exponential_delay(1.00))

    bulk_data = {}
    for node_id_chunk in chunked(node_ids, EVENT_LIMIT):
        bulk_results = fetch_retry_policy(lambda: nodestore.backend.get_multi(node_id_chunk))
        bulk_data.update(bulk_results)

    return {
        node_id_to_event_id[node_id]: Event(
            event_id=node_id_to_event_id[node_id], project_id=project_id, data=data
        )
        for node_id, data in bulk_data.items()
        if data is not None
    }


def parse_rulegroup_to_event_data(
    rulegroup_to_event_data: dict[str, str],
) -> dict[tuple[int, int], dict[str, str]]:
    parsed_rulegroup_to_event_data = {}
    for rule_group, instance_data in rulegroup_to_event_data.items():
        event_data = json.loads(instance_data)
        rule_id, group_id = rule_group.split(":")
        parsed_rulegroup_to_event_data[(int(rule_id), int(group_id))] = event_data
    return parsed_rulegroup_to_event_data


def build_group_to_groupevent(
    log_config: LogConfig,
    parsed_rulegroup_to_event_data: dict[tuple[int, int], dict[str, str]],
    bulk_event_id_to_events: dict[str, Event],
    bulk_occurrence_id_to_occurrence: dict[str, IssueOccurrence],
    group_id_to_group: dict[int, Group],
    project_id: int,
) -> dict[Group, GroupEvent]:

    project = fetch_project(project_id)
    if project:
        if log_config.num_events_issue_debugging:
            logger.info(
                "delayed_processing.build_group_to_groupevent_input",
                extra={
                    "parsed_rulegroup_to_event_data": {
                        f"{k[0]}:{k[1]}": v for k, v in parsed_rulegroup_to_event_data.items()
                    },
                    "bulk_event_id_to_events": bulk_event_id_to_events,
                    "bulk_occurrence_id_to_occurrence": bulk_occurrence_id_to_occurrence,
                    "group_id_to_group": group_id_to_group,
                    "project_id": project_id,
                },
            )
    group_to_groupevent = {}

    for rule_group, instance_data in parsed_rulegroup_to_event_data.items():
        event_id = instance_data.get("event_id")
        occurrence_id = instance_data.get("occurrence_id")

        if event_id is None:
            logger.info(
                "delayed_processing.missing_event_id",
                extra={"rule": rule_group[0], "project_id": project_id},
            )
            continue

        event = bulk_event_id_to_events.get(event_id)
        group = group_id_to_group.get(int(rule_group[1]))

        if not group or not event:
            if log_config.num_events_issue_debugging:
                logger.info(
                    "delayed_processing.missing_event_or_group",
                    extra={
                        "rule": rule_group[0],
                        "project_id": project_id,
                        "event_id": event_id,
                        "event_missing": event is None,
                        "group_missing": group is None,
                        "group_id": group.id if group else None,
                    },
                )
            continue

        group_event = event.for_group(group)
        if occurrence_id:
            group_event.occurrence = bulk_occurrence_id_to_occurrence.get(occurrence_id)
        group_to_groupevent[group] = group_event
    return group_to_groupevent


def get_group_to_groupevent(
    log_config: LogConfig,
    parsed_rulegroup_to_event_data: dict[tuple[int, int], dict[str, str]],
    project_id: int,
    group_ids: set[int],
) -> dict[Group, GroupEvent]:
    groups = Group.objects.filter(id__in=group_ids)
    group_id_to_group = {group.id: group for group in groups}

    # Filter down to only the event data for the groups we've been asked to process.
    relevant_rulegroup_to_event_data = {
        key: value for key, value in parsed_rulegroup_to_event_data.items() if key[1] in group_ids
    }

    # Use a list comprehension for event_ids
    event_ids: list[str] = [
        event_id
        for event_id in (
            instance_data.get("event_id")
            for instance_data in relevant_rulegroup_to_event_data.values()
        )
        if event_id is not None
    ]

    occurrence_ids: set[str] = {
        occurrence_id
        for occurrence_id in (
            instance_data.get("occurrence_id")
            for instance_data in relevant_rulegroup_to_event_data.values()
        )
        if occurrence_id is not None
    }

    bulk_event_id_to_events = bulk_fetch_events(event_ids, project_id)

    bulk_occurrences = []
    # We aren't guaranteed to have occurrences for all the events.
    if occurrence_ids:
        bulk_occurrences = IssueOccurrence.fetch_multi(list(occurrence_ids), project_id=project_id)

    bulk_occurrence_id_to_occurrence = {
        occurrence.id: occurrence for occurrence in bulk_occurrences if occurrence
    }

    return build_group_to_groupevent(
        log_config,
        relevant_rulegroup_to_event_data,
        bulk_event_id_to_events,
        bulk_occurrence_id_to_occurrence,
        group_id_to_group,
        project_id,
    )


def get_condition_group_results(
    condition_groups: dict[UniqueConditionQuery, DataAndGroups], project: Project
) -> dict[UniqueConditionQuery, dict[int, int | float]] | None:
    condition_group_results = {}
    current_time = datetime.now(tz=timezone.utc)
    project_id = project.id

    for unique_condition, (condition_data, group_ids, rule_id) in condition_groups.items():
        cls_id = unique_condition.cls_id
        condition_cls = rules.get(cls_id)
        if condition_cls is None:
            logger.warning(
                "Unregistered condition %r",
                cls_id,
                extra={"project_id": project_id},
            )
            continue

        if rule_id:
            rule = Rule.objects.get(id=rule_id)
        else:
            rule = None

        condition_inst = condition_cls(
            project=project, data=condition_data, rule=rule  # type: ignore[arg-type]
        )

        if not isinstance(condition_inst, BaseEventFrequencyCondition):
            logger.warning("Unregistered condition %r", cls_id, extra={"project_id": project_id})
            continue

        _, duration = condition_inst.intervals[unique_condition.interval]

        comparison_interval: timedelta | None = None
        if unique_condition.comparison_interval is not None:
            comparison_interval = COMPARISON_INTERVALS_VALUES.get(
                unique_condition.comparison_interval
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


def passes_comparison(
    condition_group_results: dict[UniqueConditionQuery, dict[int, int | float]],
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
    except KeyError:
        metrics.incr("delayed_processing.missing_query_result")
        logger.info(
            "delayed_processing.missing_query_result",
            extra={
                "condition_data": condition_data,
                "project_id": project_id,
                "group_id": group_id,
            },
        )
        return False

    calculated_value = query_values[0]
    if condition_data.get("comparisonType") == ComparisonType.PERCENT:
        calculated_value = percent_increase(calculated_value, query_values[1])

    target_value = float(condition_data["value"])

    return calculated_value > target_value


def get_rules_to_fire(
    condition_group_results: dict[UniqueConditionQuery, dict[int, int | float]],
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
                if passes_comparison(
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


def fire_rules(
    log_config: LogConfig,
    rules_to_fire: DefaultDict[Rule, set[int]],
    parsed_rulegroup_to_event_data: dict[tuple[int, int], dict[str, str]],
    alert_rules: list[Rule],
    project: Project,
) -> None:
    now = datetime.now(tz=timezone.utc)
    project_id = project.id
    with track_batch_performance(
        "delayed_processing.fire_rules.loop",
        logger,
        timedelta(seconds=40),
        extra={"project_id": project_id},
    ) as tracker:
        groups_to_fire = set().union(*rules_to_fire.values())
        group_to_groupevent = get_group_to_groupevent(
            log_config, parsed_rulegroup_to_event_data, project_id, groups_to_fire
        )
        if log_config.num_events_issue_debugging or log_config.workflow_engine_process_workflows:
            serialized_groups = {
                group.id: group_event.event_id for group, group_event in group_to_groupevent.items()
            }
            logger.info(
                "delayed_processing.group_to_groupevent",
                extra={
                    "group_to_groupevent": serialized_groups,
                    "project_id": project_id,
                },
            )
        group_id_to_group = {group.id: group for group in group_to_groupevent.keys()}
        for rule, group_ids in rules_to_fire.items():
            with tracker.track(f"rule_{rule.id}"):
                sentry_sdk.get_current_scope().set_tag("rule_id", rule.id)
                frequency = rule.data.get("frequency") or Rule.DEFAULT_FREQUENCY
                freq_offset = now - timedelta(minutes=frequency)
                for group_id in group_ids:
                    group = group_id_to_group.get(group_id)
                    if not group:
                        # we need to fire the rule for this group, but we don't have the group
                        logger.error(
                            "delayed_processing.missing_group_to_fire",
                            extra={
                                "rule_id": rule.id,
                                "group_id": group_id,
                                "project_id": project_id,
                            },
                        )
                        continue

                    rule_statuses = bulk_get_rule_status(alert_rules, group, project)
                    status = rule_statuses[rule.id]
                    if status.last_active and status.last_active > freq_offset:
                        logger.info(
                            "delayed_processing.last_active",
                            extra={
                                "last_active": status.last_active,
                                "freq_offset": freq_offset,
                                "rule_id": rule.id,
                                "project_id": project_id,
                                "group_id": group.id,
                            },
                        )
                        continue

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
                                "rule_id": rule.id,
                                "project_id": project_id,
                                "group_id": group.id,
                            },
                        )
                        continue

                    notification_uuid = str(uuid.uuid4())
                    groupevent = group_to_groupevent[group]
                    rule_fire_history = history.record(
                        rule, group, groupevent.event_id, notification_uuid
                    )

                    if (
                        log_config.workflow_engine_process_workflows
                        or log_config.num_events_issue_debugging
                    ):
                        logger.info(
                            "post_process.delayed_processing.triggered_rule",
                            extra={
                                "rule_id": rule.id,
                                "group_id": group.id,
                                "event_id": groupevent.event_id,
                            },
                        )

                    callback_and_futures = activate_downstream_actions(
                        rule,
                        groupevent,
                        notification_uuid,
                        rule_fire_history,
                        is_post_process=False,
                    ).values()

                    if not features.has(
                        "organizations:workflow-engine-trigger-actions", group.organization
                    ):
                        for callback, futures in callback_and_futures:
                            try:
                                callback(groupevent, futures)
                            except SoftTimeLimitExceeded:
                                # If we're out of time, we don't want to continue.
                                # Raise so we can retry.
                                raise
                            except Exception as e:
                                func_name = getattr(callback, "__name__", str(callback))
                                logger.exception(
                                    "%s.process_error", func_name, extra={"exception": e}
                                )

                    if log_config.num_events_issue_debugging:
                        logger.info(
                            "delayed_processing.rules_fired",
                            extra={
                                "total": len(callback_and_futures),
                                "project_id": project_id,
                                "group_id": group.id,
                                "event_id": groupevent.event_id,
                                "rule_id": rule.id,
                            },
                        )


def cleanup_redis_buffer(
    log_config: LogConfig,
    project: Project,
    rules_to_groups: DefaultDict[int, set[int]],
    batch_key: str | None,
) -> None:
    hashes_to_delete = [
        f"{rule}:{group}" for rule, groups in rules_to_groups.items() for group in groups
    ]
    filters: dict[str, BufferField] = {"project_id": project.id}
    if batch_key:
        filters["batch_key"] = batch_key

    buffer.backend.delete_hash(model=Project, filters=filters, fields=hashes_to_delete)
    if log_config.num_events_issue_debugging:
        logger.info(
            "delayed_processing.cleanup_redis_buffer",
            extra={"hashes_to_delete": hashes_to_delete, "project_id": project.id},
        )


@instrumented_task(
    name="sentry.rules.processing.delayed_processing",
    queue="delayed_rules",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=issues_tasks,
        processing_deadline_duration=60,
        retry=Retry(
            times=5,
            delay=5,
        ),
    ),
)
def apply_delayed(project_id: int, batch_key: str | None = None, *args: Any, **kwargs: Any) -> None:
    """
    Grab rules, groups, and events from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """
    sentry_sdk.get_current_scope().set_tag("project_id", project_id)
    with sentry_sdk.start_span(
        op="delayed_processing.prepare_data", name="Fetch data from buffers in delayed processing"
    ):
        project = fetch_project(project_id)
        if not project:
            return

        log_config = LogConfig.create(project)

        rulegroup_to_event_data = fetch_rulegroup_to_event_data(project_id, batch_key)
        rules_to_groups = get_rules_to_groups(rulegroup_to_event_data)
        alert_rules = fetch_alert_rules(list(rules_to_groups.keys()))
        condition_groups = get_condition_query_groups(alert_rules, rules_to_groups)
        logger.info(
            "delayed_processing.condition_groups",
            extra={
                "condition_groups": len(condition_groups),
                "project_id": project_id,
                "rules_to_groups": rules_to_groups,
            },
        )
    sentry_sdk.get_current_scope().set_tag("organization_slug", project.organization.slug)

    with (
        metrics.timer("delayed_processing.get_condition_group_results.duration"),
        sentry_sdk.start_span(
            op="delayed_processing.get_condition_group_results",
            name="Fetch condition group results in delayed processing",
        ),
    ):
        condition_group_results = get_condition_group_results(condition_groups, project)

    if log_config.workflow_engine_process_workflows or log_config.num_events_issue_debugging:
        serialized_results = (
            {str(query): count_dict for query, count_dict in condition_group_results.items()}
            if condition_group_results
            else None
        )
        logger.info(
            "delayed_processing.condition_group_results",
            extra={
                "condition_group_results": serialized_results,
                "project_id": project_id,
            },
        )

    rules_to_slow_conditions = defaultdict(list)
    for rule in alert_rules:
        rules_to_slow_conditions[rule].extend(get_slow_conditions(rule))

    with sentry_sdk.start_span(
        op="delayed_processing.get_rules_to_fire",
        name="Process rule conditions in delayed processing",
    ):
        rules_to_fire = defaultdict(set)
        if condition_group_results:
            rules_to_fire = get_rules_to_fire(
                condition_group_results, rules_to_slow_conditions, rules_to_groups, project.id
            )
            if (
                log_config.workflow_engine_process_workflows
                or log_config.num_events_issue_debugging
            ):
                logger.info(
                    "delayed_processing.rules_to_fire",
                    extra={
                        "rules_to_fire": {
                            rule.id: groups for rule, groups in rules_to_fire.items()
                        },
                        "project_id": project_id,
                        "rules_to_slow_conditions": {
                            rule.id: conditions
                            for rule, conditions in rules_to_slow_conditions.items()
                        },
                        "rules_to_groups": rules_to_groups,
                    },
                )
            if random.random() < 0.01:
                logger.info(
                    "delayed_processing.rule_to_fire",
                    extra={"rules_to_fire": list(rules_to_fire.keys()), "project_id": project_id},
                )

    with sentry_sdk.start_span(
        op="delayed_processing.fire_rules", name="Fire rules in delayed processing"
    ):
        parsed_rulegroup_to_event_data = parse_rulegroup_to_event_data(rulegroup_to_event_data)
        with metrics.timer("delayed_processing.fire_rules.duration"):
            fire_rules(
                log_config, rules_to_fire, parsed_rulegroup_to_event_data, alert_rules, project
            )

    with sentry_sdk.start_span(
        op="delayed_processing.cleanup_redis_buffer",
        name="Clean up redis buffer in delayed processing",
    ):
        cleanup_redis_buffer(log_config, project, rules_to_groups, batch_key)


@delayed_processing_registry.register("delayed_processing")  # default delayed processing
class DelayedRule(DelayedProcessingBase):
    buffer_key = PROJECT_ID_BUFFER_LIST_KEY
    option = None

    @property
    def hash_args(self) -> BufferHashKeys:
        return BufferHashKeys(model=Project, filters=FilterKeys(project_id=self.project_id))

    @property
    def processing_task(self) -> Task:
        return apply_delayed
