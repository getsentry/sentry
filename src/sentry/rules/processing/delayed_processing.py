import logging
from collections import defaultdict

from sentry.buffer.redis import BufferHookEvent, RedisBuffer, redis_buffer_registry
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules.conditions.base import EventCondition
from sentry.rules.conditions.event_frequency import EventFrequencyConditionData
from sentry.rules.processing.processor import is_condition_slow, split_conditions_and_filters
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper

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
    rulegroup_to_event = buffer.get_hash(model=Project, field={"id": project.id})

    # STEP 2: Map each rule to the groups that must be checked for that rule.
    rules_to_groups = defaultdict(set)
    for rule_group in rulegroup_to_event.keys():
        rule_id, group_id = rule_group.split(":")
        rules_to_groups[rule_id].add(group_id)

    # STEP 3: Fetch the Rule models we need to check
    rules = Rule.objects.filter(id__in=list(rules_to_groups.keys()))

    # STEP 4: Create a map of unique conditions to the groups that must be
    # checked for that condition, as well as the information needed to. We don't
    # query per rule condition because condition of the same class, interval,
    # and environment can share a single scan.
    # e.g. In prod env
    #   - num issues in a group > 5   over 1 hr
    #   - num issues in a group < 100 over 1 hr

    # Map unique conditions to the group IDs that need to checked for that
    # condition. We also store a pointer to that condition's JSON so we can
    # instantiate the class later
    condition_groups = defaultdict(set)
    for rule in rules:
        # We only want to a rule's fast conditions because rules are only added
        # to the buffer if we've already checked their fast conditions.
        slow_conditions = get_slow_conditions(rule)
        for condition in slow_conditions:
            unique_condition = (condition["id"], condition.interval, rule.environment_id)
            condition_groups[unique_condition].update(rules_to_groups[rule.id])

    # Step 5: Instantiate each unique condition, and evaluate the relevant
    # group_ids that apply for that condition
    condition_group_results = defaultdict(int)
    for (condition_cls_id, cond_interval, environment_id), group_ids in condition_groups.items():
        condition_cls = rules.get(condition_cls_id)

        if condition_cls is None:
            logger.warning("Unregistered condition %r", condition["id"])
            return None

        condition_inst = condition_cls(project=project, data=condition, rule=rule)
        if not isinstance(condition_inst, EventCondition):
            logger.warning("Unregistered condition %r", condition["id"])
            return None

        # have event to pass into when instantiating condition
        # condition to execute, group_ids
        # group_results: dict[int, int] = cond.batch_query(group_ids)
        # for group_id, result in group_results.items():
        #     condition_group_results[(cond, group_id)] = result

        # safe_execute(
        #     apply_delayed,
        #     project,
        #     rulegroup_event_mapping,
        #     _with_transaction=False,
        # )
