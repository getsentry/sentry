import contextlib
import logging
from collections import defaultdict
from datetime import timedelta, timezone
from typing import DefaultDict, NamedTuple

from sentry.buffer.redis import BufferHookEvent, RedisBuffer, redis_buffer_registry
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules.conditions.base import EventCondition
from sentry.rules.conditions.event_frequency import (
    BaseEventFrequencyCondition,
    ComparisonType,
    EventFrequencyConditionData,
    percent_increase,
)
from sentry.rules.processing.processor import is_condition_slow, split_conditions_and_filters
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import options_override

# XXX: Where should the safe_execute part go? Is it even needed for tasks?
# from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.rules.delayed_processing")


PROJECT_ID_BUFFER_LIST_KEY = "project_id_buffer_list"


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
    # STEP 1: Fetch the rulegroup_to_event mapping for the project from redis

    # The mapping looks like: {rule.id}:{group.id} -> {event.id}
    # TODO: Updating return type of get_hash
    rulegroup_to_event = buffer.get_hash(model=Project, field={"id": project.id})

    # STEP 2: Map each rule to the groups that must be checked for that rule.
    rules_to_groups: DefaultDict[str, set[int]] = defaultdict(set)
    for rule_group in rulegroup_to_event.keys():
        rule_id, group_id = rule_group.split(":")
        rules_to_groups[rule_id].add(group_id)

    # STEP 3: Fetch the Rule models we need to check
    rules = Rule.objects.filter(id__in=list(rules_to_groups.keys()))

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
        data: EventFrequencyConditionData
        group_ids: set[int]

    condition_groups: dict[UniqueCondition, DataAndGroups] = {}

    for rule in rules:
        # We only want to a rule's fast conditions because rules are only added
        # to the buffer if we've already checked their fast conditions.
        slow_conditions = get_slow_conditions(rule)
        for condition_data in slow_conditions:
            unique_condition = UniqueCondition(
                condition_data["id"], condition_data["interval"], rule.environment_id
            )

            # Add to set the set of group_ids if there are already group_ids for
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
    condition_group_results: dict[UniqueCondition, dict[int, int]] = {}
    for unique_condition, (condition_data, group_ids) in condition_groups.items():
        condition_cls = rules.get(unique_condition.cls_id)

        if condition_cls is None:
            logger.warning("Unregistered condition %r", condition_data["id"])
            return None

        condition_inst: BaseEventFrequencyCondition = condition_cls(
            project=project, data=condition_data, rule=rule
        )
        if not isinstance(condition_inst, EventCondition):
            logger.warning("Unregistered condition %r", condition_data["id"])
            return None

        _, duration = condition_inst.intervals[unique_condition.interval]
        end = timezone.now()
        # For conditions with interval >= 1 hour we don't need to worry about read your writes
        # consistency. Disable it so that we can scale to more nodes.
        option_override_cm: contextlib.AbstractContextManager[object] = contextlib.nullcontext()
        if duration >= timedelta(hours=1):
            option_override_cm = options_override({"consistent": False})

        with option_override_cm:
            results = condition_inst.batch_query(
                group_ids, end - duration, end, environment_id=unique_condition.environment_id
            )
            comparison_type = condition_data.get("comparisonType", ComparisonType.COUNT)
            if comparison_type == ComparisonType.PERCENT:
                comparison_interval = condition_inst.intervals[unique_condition.interval][1]
                comparison_end = end - comparison_interval

                comparison_results = condition_inst.batch_query(
                    group_ids,
                    comparison_end - duration,
                    comparison_end,
                    environment_id=unique_condition.environment_id,
                )

            results = {
                group_id: percent_increase(results[group_id], comparison_results[group_id])
                for group_id in group_ids
            }

        condition_group_results[unique_condition] = results

        # group_results: dict[int, int] = cond.batch_query(group_ids)
        # for group_id, result in group_results.items():
        #     condition_group_results[(cond, group_id)] = result

        # safe_execute(
        #     apply_delayed,
        #     project,
        #     rulegroup_event_mapping,
        #     _with_transaction=False,
        # )
