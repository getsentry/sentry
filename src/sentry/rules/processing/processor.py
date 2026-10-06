from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from typing import Any

from sentry.notifications.types import NotificationRule, RuleFuture
from sentry.rules import rules
from sentry.rules.actions.base import instantiate_action
from sentry.services.eventstore.models import GroupEvent
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)


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
    rule: NotificationRule,
    event: GroupEvent,
    notification_uuid: str | None = None,
) -> MutableMapping[
    str | Callable[[GroupEvent, Sequence[RuleFuture]], None],
    tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]],
]:
    grouped_futures: MutableMapping[
        str | Callable[[GroupEvent, Sequence[RuleFuture]], None],
        tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]],
    ] = {}

    for action in rule.data.get("actions", ()):
        action_inst = instantiate_action(rule, action)
        if not action_inst:
            continue

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
