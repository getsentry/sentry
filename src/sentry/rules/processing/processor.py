from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from typing import Any

from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules import rules
from sentry.rules.actions.base import instantiate_action
from sentry.services.eventstore.models import GroupEvent
from sentry.types.rules import RuleFuture
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)

SLOW_CONDITION_MATCHES = ["event_frequency"]
PROJECT_ID_BUFFER_LIST_KEY = "project_id_buffer_list"


def get_match_function(match_name: str) -> Callable[..., bool] | None:
    if match_name == "all":
        return all
    elif match_name == "any":
        return any
    elif match_name == "none":
        return lambda bool_iter: not any(bool_iter)
    return None


def is_condition_slow(
    condition: Mapping[str, Any],
) -> bool:
    """
    Returns whether a condition is considered slow. Note that slow conditions in
    the condition Mapping take on the form of EventFrequencyConditionData.
    """
    for slow_conditions in SLOW_CONDITION_MATCHES:
        if slow_conditions in condition["id"]:
            return True
    return False


def get_rule_type(condition: Mapping[str, Any]) -> str | None:
    rule_cls = rules.get(condition["id"])
    if rule_cls is None:
        logger.warning("Unregistered condition or filter %r", condition["id"])
        return None

    rule_type: str = rule_cls.rule_type
    return rule_type


def split_conditions_and_filters(
    rule_condition_list,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    condition_list = []
    filter_list = []
    for rule_cond in rule_condition_list:
        if get_rule_type(rule_cond) == "condition/event":
            condition_list.append(rule_cond)
        else:
            filter_list.append(rule_cond)

    return condition_list, filter_list


def activate_downstream_actions(
    rule: Rule,
    event: GroupEvent,
    notification_uuid: str | None = None,
    rule_fire_history: RuleFireHistory | None = None,
) -> MutableMapping[
    str, tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]
]:
    grouped_futures: MutableMapping[
        str, tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]
    ] = {}

    instantiated_actions = 0

    for action in rule.data.get("actions", ()):
        action_inst = instantiate_action(rule, action, rule_fire_history)
        if not action_inst:
            continue

        instantiated_actions += 1

        results = safe_execute(
            action_inst.after,
            event=event,
            notification_uuid=notification_uuid,
        )
        if results is None:
            logger.warning("Action %s did not return any futures", action["id"])
            continue

        for future in results:
            key = future.key if future.key is not None else future.callback
            rule_future = RuleFuture(rule=rule, kwargs=future.kwargs)

            if key not in grouped_futures:
                grouped_futures[key] = (future.callback, [rule_future])
            else:
                grouped_futures[key][1].append(rule_future)

    return grouped_futures
