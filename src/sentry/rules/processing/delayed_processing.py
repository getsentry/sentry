import logging
import uuid
from collections import defaultdict
from datetime import timedelta
from typing import DefaultDict, NamedTuple

from django.utils import timezone

from sentry import eventstore
from sentry.buffer.redis import BufferHookEvent, RedisBuffer, redis_buffer_registry
from sentry.eventstore.models import Event, GroupEvent
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.grouprulestatus import GroupRuleStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules import history, rules
from sentry.rules.conditions.event_frequency import (
    BaseEventFrequencyCondition,
    ComparisonType,
    EventFrequencyConditionData,
)
from sentry.rules.processing.processor import (
    activate_downstream_actions,
    bulk_get_rule_status,
    is_condition_slow,
    split_conditions_and_filters,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.rules.delayed_processing")


PROJECT_ID_BUFFER_LIST_KEY = "project_id_buffer_list"


class UniqueCondition(NamedTuple):
    cls_id: str
    interval: str
    environment_id: int

    def __repr__(self):
        return f"id: {self.cls_id},\ninterval: {self.interval},\nenv id: {self.environment_id}"


class DataAndGroups(NamedTuple):
    data: EventFrequencyConditionData | None
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
    for rule_group in rulegroup_to_event_data.keys():
        rule_id, group_id = rule_group.split(":")
        rules_to_groups[int(rule_id)].add(int(group_id))

    return rules_to_groups


def get_rule_to_slow_conditions(
    alert_rules: list[Rule],
) -> DefaultDict[Rule, list[EventFrequencyConditionData]]:
    rule_to_slow_conditions: DefaultDict[Rule, list[EventFrequencyConditionData]] = defaultdict(
        list
    )
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
) -> dict[UniqueCondition, dict[int, int]] | None:
    condition_group_results: dict[UniqueCondition, dict[int, int]] = {}
    for unique_condition, (condition_data, group_ids) in condition_groups.items():
        condition_cls = rules.get(unique_condition.cls_id)

        if condition_cls is None:
            logger.warning("Unregistered condition %r", unique_condition.cls_id)
            return None

        # MyPy refuses to make TypedDict compatible with MutableMapping
        # https://github.com/python/mypy/issues/4976
        condition_inst = condition_cls(project=project, data=condition_data)  # type: ignore[arg-type]
        if not isinstance(condition_inst, BaseEventFrequencyCondition):
            logger.warning("Unregistered condition %r", condition_cls.id)
            return None

        _, duration = condition_inst.intervals[unique_condition.interval]
        comparison_interval = condition_inst.intervals[unique_condition.interval][1]
        comparison_type = (
            condition_data.get("comparisonType", ComparisonType.COUNT)
            if condition_data
            else ComparisonType.COUNT
        )
        result = safe_execute(
            condition_inst.get_rate_bulk,
            duration,
            comparison_interval,
            group_ids,
            unique_condition.environment_id,
            comparison_type,
        )
        condition_group_results[unique_condition] = result
    return condition_group_results


def get_rules_to_fire(
    condition_group_results: dict[UniqueCondition, dict[int, int]],
    rule_to_slow_conditions: DefaultDict[Rule, list[EventFrequencyConditionData]],
    rules_to_groups: DefaultDict[int, set[int]],
) -> DefaultDict[Rule, set[int]]:
    rules_to_fire = defaultdict(set)
    for alert_rule, slow_conditions in rule_to_slow_conditions.items():
        action_match = alert_rule.data.get("action_match", "any")
        for group_id in rules_to_groups[alert_rule.id]:
            conditions_matched = 0
            for slow_condition in slow_conditions:
                unique_condition = UniqueCondition(
                    str(slow_condition.get("id")),
                    str(slow_condition.get("interval")),
                    alert_rule.environment_id,
                )
                results = condition_group_results.get(unique_condition, {})
                if results:
                    target_value = int(str(slow_condition.get("value")))
                    if results[group_id] > target_value:
                        if action_match == "any":
                            rules_to_fire[alert_rule].add(group_id)
                            break
                        conditions_matched += 1
                    else:
                        if action_match == "all":
                            # We failed to match all conditions for this group, skip
                            break
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


def get_group_to_groupevent(
    parsed_rulegroup_to_event_data: dict[tuple[str, str], dict[str, str]],
    project_id: int,
    group_ids: set[int],
) -> dict[Group, GroupEvent]:
    group_to_groupevent: dict[Group, GroupEvent] = {}
    groups = Group.objects.filter(id__in=group_ids)
    group_id_to_group = {group.id: group for group in groups}
    for rule_group, instance_data in parsed_rulegroup_to_event_data.items():
        event_id = instance_data.get("event_id")
        occurrence_id = instance_data.get("occurrence_id")
        group_id = rule_group[1]
        group = group_id_to_group.get(int(group_id))
        if group and event_id:
            # TODO: fetch events and occurrences in batches
            event = Event(
                event_id=event_id,
                project_id=project_id,
                snuba_data={
                    "event_id": event_id,
                    "group_id": group.id,
                    "project_id": project_id,
                },
            )
            eventstore.backend.bind_nodes([event])
            group_event = event.for_group(group)
            if occurrence_id:
                occurrence = IssueOccurrence.fetch(occurrence_id, project_id=project_id)
                if occurrence:
                    group_event.occurrence = occurrence

            group_to_groupevent[group] = group_event
    return group_to_groupevent


@redis_buffer_registry.add_handler(BufferHookEvent.FLUSH)
def process_delayed_alert_conditions(buffer: RedisBuffer) -> None:
    with metrics.timer("delayed_processing.process_all_conditions.duration"):
        project_ids = buffer.get_set(PROJECT_ID_BUFFER_LIST_KEY)
        for project_id in project_ids:
            with metrics.timer("delayed_processing.process_project.duration"):
                apply_delayed.delay(project_id=project_id)


@instrumented_task(
    name="sentry.delayed_processing.tasks.apply_delayed",
    queue="delayed_rules",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=50,
    time_limit=60,  # 1 minute
    silo_mode=SiloMode.REGION,
)
def apply_delayed(project_id: int) -> None:
    """
    Grab rules, groups, and events from the Redis buffer, evaluate the "slow" conditions in a bulk snuba query, and fire them if they pass
    """
    # STEP 1: Fetch the rulegroup_to_event_data mapping for the project from redis
    project = Project.objects.get_from_cache(id=project_id)
    buffer = RedisBuffer()
    rulegroup_to_event_data = buffer.get_hash(model=Project, field={"project_id": project.id})
    # STEP 2: Map each rule to the groups that must be checked for that rule.
    rules_to_groups = get_rules_to_groups(rulegroup_to_event_data)

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

    if condition_group_results:
        rules_to_fire = get_rules_to_fire(
            condition_group_results, rule_to_slow_conditions, rules_to_groups
        )
    # Step 7: Fire the rule's actions
    now = timezone.now()
    # TODO: check rulesnooze table again before firing
    parsed_rulegroup_to_event_data = parse_rulegroup_to_event_data(rulegroup_to_event_data)

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
                return

            updated = (
                GroupRuleStatus.objects.filter(id=status.id)
                .exclude(last_active__gt=freq_offset)
                .update(last_active=now)
            )

            if not updated:
                return

            notification_uuid = str(uuid.uuid4())
            groupevent = group_to_groupevent[group]
            rule_fire_history = history.record(rule, group, groupevent.event_id, notification_uuid)
            for callback, futures in activate_downstream_actions(
                rule, groupevent, notification_uuid, rule_fire_history
            ).values():
                safe_execute(callback, groupevent, futures, _with_transaction=False)
