import contextlib
import logging
from collections import defaultdict
from collections.abc import MutableMapping
from datetime import UTC, datetime, timedelta
from typing import Any, DefaultDict, NamedTuple

from sentry import eventstore
from sentry.buffer.redis import BufferHookEvent, RedisBuffer, redis_buffer_registry
from sentry.eventstore.models import Event
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules import rules
from sentry.rules.conditions.base import EventCondition
from sentry.rules.conditions.event_frequency import (
    BaseEventFrequencyCondition,
    ComparisonType,
    percent_increase,
)
from sentry.rules.processing.processor import is_condition_slow, split_conditions_and_filters
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import options_override

logger = logging.getLogger("sentry.rules.delayed_processing")


PROJECT_ID_BUFFER_LIST_KEY = "project_id_buffer_list"


class UniqueCondition(NamedTuple):
    cls_id: str
    interval: str
    environment_id: int

    def __repr__(self):
        return f"id: {self.cls_id},\ninterval: {self.interval},\nenv id: {self.environment_id}"


class DataAndGroups(NamedTuple):
    data: MutableMapping[str, Any] | None
    group_ids: set[int]

    def __repr__(self):
        return f"data: {self.data}\ngroup_ids: {self.group_ids}"


def get_slow_conditions(rule: Rule) -> list[MutableMapping[str, str] | None]:
    """
    Returns the slow conditions of a rule model instance.
    """
    conditions_and_filters = rule.data.get("conditions", ())
    conditions, _ = split_conditions_and_filters(conditions_and_filters)
    slow_conditions: list[MutableMapping[str, str] | None] = [
        cond for cond in conditions if is_condition_slow(cond)
    ]

    return slow_conditions


def get_rules_to_groups(
    rulegroup_to_events: list[dict[str, set[str]]]
) -> DefaultDict[int, set[int]]:
    rules_to_groups: DefaultDict[int, set[int]] = defaultdict(set)
    for rulegroup_to_event in rulegroup_to_events:
        for rule_group in rulegroup_to_event.keys():
            rule_id, group_id = rule_group.split(":")
            rules_to_groups[int(rule_id)].add(int(group_id))

    return rules_to_groups


def get_rule_to_slow_conditions(alert_rules: list[Rule]) -> DefaultDict[Rule, list[dict[str, Any]]]:
    rule_to_slow_conditions: DefaultDict[Rule, list[dict[str, Any]]] = defaultdict(list)
    for rule in alert_rules:
        slow_conditions = get_slow_conditions(rule)
        for condition_data in slow_conditions:
            rule_to_slow_conditions[rule].append(condition_data)

    return rule_to_slow_conditions


def get_condition_groups(
    alert_rules: list[Rule], rules_to_groups: DefaultDict[int, set[int]]
) -> dict[UniqueCondition, DataAndGroups]:
    """Map unique conditions to the group IDs that need to checked for that
    condition. We also store a pointer to that condition's JSON so we can
    instantiate the class later
    """
    condition_groups: dict[UniqueCondition, DataAndGroups] = {}
    for rule in alert_rules:
        # We only want a rule's slow conditions because alert_rules are only added
        # to the buffer if we've already checked their fast conditions.
        slow_conditions = get_slow_conditions(rule)
        for condition_data in slow_conditions:
            if condition_data:
                unique_condition = UniqueCondition(
                    condition_data["id"], condition_data["interval"], rule.environment_id
                )
                # Add to set of group_ids if there are already group_ids
                # that apply to the unique condition
                if data_and_groups := condition_groups.get(unique_condition):
                    data_and_groups.group_ids.update(rules_to_groups[rule.id])
                # Otherwise, create the tuple containing the condition data and the
                # set of group_ids that apply to the unique condition
                else:
                    condition_groups[unique_condition] = DataAndGroups(
                        condition_data, rules_to_groups[rule.id]
                    )
    return condition_groups


def get_condition_group_results(
    condition_groups: dict[UniqueCondition, DataAndGroups],
    project: Project,
) -> dict[UniqueCondition, dict[int, int]]:
    # XXX: Probably want to safe execute somewhere in this step before making
    # the query
    condition_group_results: dict[UniqueCondition, dict[int, int]] = {}
    for unique_condition, (condition_data, group_ids) in condition_groups.items():
        condition_cls = rules.get(unique_condition.cls_id)

        if condition_cls is None:
            logger.warning("Unregistered condition %r", unique_condition.cls_id)
            return None

        condition_inst: BaseEventFrequencyCondition = condition_cls(
            project=project, data=condition_data
        )
        if not isinstance(condition_inst, EventCondition):
            logger.warning("Unregistered condition %r", condition_cls.id)
            return None

        _, duration = condition_inst.intervals[unique_condition.interval]
        end = datetime.now()
        # For conditions with interval >= 1 hour we don't need to worry about read your writes
        # consistency. Disable it so that we can scale to more nodes.
        option_override_cm: contextlib.AbstractContextManager[object] = contextlib.nullcontext()
        if duration >= timedelta(hours=1):
            option_override_cm = options_override({"consistent": False})

        with option_override_cm:
            start = end - duration
            results = condition_inst.batch_query(
                group_ids=group_ids,
                start=start.replace(tzinfo=UTC),
                end=end.replace(tzinfo=UTC),
                environment_id=unique_condition.environment_id,
            )

            # If the condition is a percent comparison, we need to query the
            # previous interval to compare against the current interval
            if condition_data:
                comparison_type = condition_data.get("comparisonType", ComparisonType.COUNT)
                if comparison_type == ComparisonType.PERCENT:
                    comparison_interval = condition_inst.intervals[unique_condition.interval][1]
                    comparison_end = end - comparison_interval
                    start = comparison_end - duration
                    comparison_results = condition_inst.batch_query(
                        group_ids=group_ids,
                        start=start.replace(tzinfo=UTC),
                        end=comparison_end.replace(tzinfo=UTC),
                        environment_id=unique_condition.environment_id,
                    )

                    results = {
                        group_id: percent_increase(results[group_id], comparison_results[group_id])
                        for group_id in group_ids
                    }

        condition_group_results[unique_condition] = results
    return condition_group_results


def get_rules_to_fire(
    condition_group_results: dict[UniqueCondition, dict[int, int]],
    rule_to_slow_conditions: DefaultDict[Rule, list[dict[str, Any]]],
    rules_to_groups: DefaultDict[int, set[int]],
) -> DefaultDict[Rule, list[int]]:
    condition_to_results = {c.cls_id: results for c, results in condition_group_results.items()}
    rules_to_fire = defaultdict(set)
    for alert_rule, slow_conditions in rule_to_slow_conditions.items():
        for slow_condition in slow_conditions:
            condition_id = slow_condition.get("id")
            target_value = int(slow_condition.get("value"))
            results = condition_to_results[condition_id]
            for group_id in rules_to_groups[alert_rule.id]:
                if results[group_id] > target_value:
                    rules_to_fire[alert_rule].add(group_id)
    return rules_to_fire


@redis_buffer_registry.add_handler(BufferHookEvent.FLUSH)
def process_delayed_alert_conditions(buffer: RedisBuffer) -> None:
    with metrics.timer("delayed_processing.process_all_conditions.duration"):
        project_ids = buffer.get_set(PROJECT_ID_BUFFER_LIST_KEY)

        for project in RangeQuerySetWrapper(Project.objects.filter(id__in=project_ids)):
            with metrics.timer("delayed_processing.process_project.duration"):
                apply_delayed.delay(project=project, buffer=buffer)


@instrumented_task(
    name="sentry.delayed_processing.tasks.apply_delayed",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=50,
    time_limit=60,  # 1 minute
    silo_mode=SiloMode.REGION,
)
def apply_delayed(project: Project, buffer: RedisBuffer) -> None:
    """
    Grab rules, groups, and events from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """

    # STEP 1: Fetch the rulegroup_to_events mapping for the project from redis
    rulegroup_to_events = buffer.get_hash(model=Project, field={"project_id": project.id})

    # STEP 2: Map each rule to the groups that must be checked for that rule.
    rules_to_groups = get_rules_to_groups(rulegroup_to_events)

    # STEP 3: Fetch the Rule models we need to check
    alert_rules = Rule.objects.filter(id__in=list(rules_to_groups.keys()))

    # STEP 4: Create a map of unique conditions to a tuple containing the JSON
    # information needed to instantiate that condition class and the group_ids that
    # must be checked for that condition. We don't query per rule condition because
    # condition of the same class, interval, and environment can share a single scan.
    condition_groups = get_condition_groups(alert_rules, rules_to_groups)

    # Step 5: Instantiate each unique condition, and evaluate the relevant
    # group_ids that apply for that condition
    condition_group_results = get_condition_group_results(condition_groups, project)

    # Step 6: For each rule and group applying to that rule, check if the group
    # meets the conditions of the rule (basically doing BaseEventFrequencyCondition.passes)
    rule_to_slow_conditions = get_rule_to_slow_conditions(alert_rules)
    rules_to_fire = get_rules_to_fire(
        condition_group_results, rule_to_slow_conditions, rules_to_groups
    )

    # Step 7: Bulk fetch the events of the rule/group pairs we need to trigger
    # actions for, then trigger those actions
    group_id_to_event_id = {}
    for rule_group, event in rulegroup_to_events:
        _, group_id = rule_group.split(":")
        group_id_to_event_id[group_id] = event

    events = [
        Event(
            event_id=event_id,
            project_id=project.id,
            snuba_data={
                "event_id": event_id,
                "group_id": group_id,
                "project_id": project.id,
            },
        )
        for group_id, event_id in group_id_to_event_id.items()
    ]
    eventstore.backend.bind_nodes(events)
    return events

    # Step 7.2(?) Fire the rules
    # double check the frequency before firing
    # https://github.com/getsentry/sentry/blob/fbfd6800cf067f171840c427df7d5c2864b91fb0/src/sentry/rules/processor.py#L209-L212

    # XXX: Be sure to update the grouprulestatus before triggering actions!
    # https://github.com/getsentry/sentry/blob/fbfd6800cf067f171840c427df7d5c2864b91fb0/src/sentry/rules/processor.py#L247-L254

    # Step 8: Clean up redis buffer data
