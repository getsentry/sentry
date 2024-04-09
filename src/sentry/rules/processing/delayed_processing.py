import logging
from collections import defaultdict
from collections.abc import Mapping

from sentry.buffer.redis import BufferHookEvent, RedisBuffer, redis_buffer_registry
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.rules.processing.processor import is_condition_slow
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.rules.delayed_processing")


PROJECT_ID_BUFFER_LIST_KEY = "project_id_buffer_list"


@redis_buffer_registry.add_handler(BufferHookEvent.FLUSH)
def process_delayed_alert_conditions(buffer: RedisBuffer) -> None:
    with metrics.timer("delayed_processing.process_all_conditions.duration"):
        project_ids = buffer.get_set(PROJECT_ID_BUFFER_LIST_KEY)

        for project in RangeQuerySetWrapper(Project.objects.filter(id__in=project_ids)):
            rulegroup_event_mapping = buffer.get_hash(model=Project, field={"id": project.id})

            with metrics.timer("delayed_processing.process_project.duration"):
                safe_execute(
                    apply_delayed,
                    project,
                    rulegroup_event_mapping,
                    _with_transaction=False,
                )


def apply_delayed(project: Project, rule_group_pairs: Mapping[str, str]) -> None:
    rule_group_mapping = defaultdict(set)
    # Map each rule to its associated groups
    for rule_group in rule_group_pairs.keys():
        rule_id, group_id = rule_group.split(":")
        rule_group_mapping[rule_id].add(group_id)

    rules = Rule.objects.filter(id__in=list(rule_group_mapping.keys()))

    condition_groups = defaultdict(set)
    for rule in rules:
        rule: Rule
        rule.conditions
        # Exclude filters and slow conditions. We only want to check fast
        # conditions because rules are only added to the buffer if we've already
        # checked their slow conditions.
        conditions = [cond for cond in rule.conditions if not is_condition_slow(cond)]
        for condition in conditions:
            unique_condition = (condition["id"], condition.interval)
            condition_groups[unique_condition].update(rule_group_mapping[rule.id])
