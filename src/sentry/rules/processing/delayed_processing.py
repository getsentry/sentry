import contextlib
import logging
from collections import defaultdict
from collections.abc import MutableMapping
from datetime import UTC, datetime, timedelta
from typing import Any, DefaultDict, NamedTuple

from sentry.buffer.redis import BufferHookEvent, RedisBuffer, redis_buffer_registry
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


def get_slow_conditions(rule: Rule) -> list[MutableMapping[str, Any] | None]:
    """
    Returns the slow conditions of a rule model instance.
    """
    conditions_and_filters = rule.data.get("conditions", ())
    conditions, _ = split_conditions_and_filters(conditions_and_filters)
    slow_conditions = [cond for cond in conditions if is_condition_slow(cond)]

    return slow_conditions


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
    """ """

    # XXX(schew2381): This is from
    # https://github.com/getsentry/sentry/blob/fbfd6800cf067f171840c427df7d5c2864b91fb0/src/sentry/rules/processor.py#L209-L212
    # Do we need to check this before we start the steps (ask dan, I think the
    # answer is no b/c we check it before triggering actions))

    # frequency = rule.data.get("frequency") or Rule.DEFAULT_FREQUENCY
    # now = datetime.now()
    # freq_offset = now - timedelta(minutes=frequency)
    # if status.last_active and status.last_active > freq_offset:
    #     return

    # STEP 1: Fetch the rulegroup_to_events mapping for the project from redis

    # The mapping looks like: '{rule.id}:{group.id}' -> {'event.id'}
    rulegroup_to_events = buffer.get_hash(model=Project, field={"project_id": project.id})

    # STEP 2: Map each rule to the groups that must be checked for that rule.
    rules_to_groups: DefaultDict[int, set[int]] = defaultdict(set)
    for rulegroup_to_event in rulegroup_to_events:
        for rule_group in rulegroup_to_event.keys():
            rule_id, group_id = rule_group.split(":")
            rules_to_groups[int(rule_id)].add(int(group_id))

    # STEP 3: Fetch the Rule models we need to check
    alert_rules = Rule.objects.filter(id__in=list(rules_to_groups.keys()))

    # STEP 4: Create a map of unique conditions to a tuple containing the JSON
    # information needed to instantiate that condition class and the group_ids that
    # must be checked for that condition. We don't query per rule condition because
    # condition of the same class, interval, and environment can share a single scan.

    # Map unique conditions to the group IDs that need to checked for that
    # condition. We also store a pointer to that condition's JSON so we can
    # instantiate the class later
    class UniqueCondition(NamedTuple):
        cls_id: str
        interval: str
        environment_id: int

    class DataAndGroups(NamedTuple):
        data: MutableMapping[str, Any] | None
        group_ids: set[int]

    condition_groups: dict[UniqueCondition, DataAndGroups] = {}

    for rule in alert_rules:
        # We only want a rule's slow conditions because alert_rules are only added
        # to the buffer if we've already checked their fast conditions.
        slow_conditions = get_slow_conditions(rule)
        for condition_data in slow_conditions:
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

    # Step 5: Instantiate each unique condition, and evaluate the relevant
    # group_ids that apply for that condition

    # XXX: Probably want to safe execute somewhere in this step before making
    # the query
    condition_group_results: dict[UniqueCondition, dict[int, int]] = {}
    for unique_condition, (condition_data, group_ids) in condition_groups.items():
        condition_cls = rules.get(unique_condition.cls_id)

        if condition_cls is None:
            logger.warning("Unregistered condition %r", unique_condition.cls_id)
            return None

        condition_inst: BaseEventFrequencyCondition = condition_cls(
            project=project, data=condition_data, rule=rule
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
            # print("start: ", end - duration)
            start = end - duration
            results = condition_inst.batch_query(
                group_ids=group_ids,
                start=start.replace(tzinfo=UTC),
                end=end.replace(tzinfo=UTC),
                environment_id=unique_condition.environment_id,
            )

            # If the condition is a percent comparison, we need to query the
            # previous interval to compare against the current interval
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

    # Step 6: For each rule and group applying to that rule, check if the group
    # meets the conditions of the rule (basically doing BaseEventFrequencyCondition.passes)
    for rule in alert_rules:
        # don't know why mypy is complaining : (expression has type "int", variable has type "str")
        for group_id in rules_to_groups[rule.id]:  # type: ignore[assignment]
            pass

            # get:
            # 1. rule conditions + result of condition check in results dict
            # 2. the predicate func (any, all) to iterate over for conditions
            # 3. The interval rules value to compare the result of the query
            #    against (e.g. # issues is > 50, 50 is the value). This is
            #    stored in DataAndGroups.data["value"], see EventFrequencyConditionData

            # Store all rule/group pairs  we need to activate

    # Step 8: Bulk fetch the events of the rule/group pairs we need to trigger
    # actions for, then trigger those actions

    # Was thinking we could do something like this where we get futures,
    # then safe execute them
    # https://github.com/getsentry/sentry/blob/3075c03e0819dd2c974897cc3014764c43151db5/src/sentry/tasks/post_process.py#L1115-L1128

    # XXX: Be sure to do this before triggering actions!
    # https://github.com/getsentry/sentry/blob/fbfd6800cf067f171840c427df7d5c2864b91fb0/src/sentry/rules/processor.py#L247-L254
