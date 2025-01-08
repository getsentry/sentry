from __future__ import annotations

import logging
import uuid
from collections.abc import Callable, Collection, Mapping, MutableMapping, Sequence
from datetime import timedelta
from random import random, randrange
from typing import Any

from django.core.cache import cache
from django.utils import timezone

from sentry import analytics, buffer
from sentry.eventstore.models import GroupEvent
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.grouprulestatus import GroupRuleStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.models.rulesnooze import RuleSnooze
from sentry.rules import EventState, history, rules
from sentry.rules.actions.base import instantiate_action
from sentry.rules.conditions.base import EventCondition
from sentry.rules.conditions.event_frequency import EventFrequencyConditionData
from sentry.rules.filters.base import EventFilter
from sentry.types.rules import RuleFuture
from sentry.utils import json, metrics
from sentry.utils.hashlib import hash_values
from sentry.utils.safe import safe_execute

logger = logging.getLogger("sentry.rules")

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


def build_rule_status_cache_key(rule_id: int, group_id: int) -> str:
    return "grouprulestatus:1:%s" % hash_values([group_id, rule_id])


def bulk_get_rule_status(
    rules: Sequence[Rule], group: Group, project: Project
) -> Mapping[int, GroupRuleStatus]:
    keys = [build_rule_status_cache_key(rule.id, group.id) for rule in rules]
    cache_results: Mapping[str, GroupRuleStatus] = cache.get_many(keys)
    missing_rule_ids: set[int] = set()
    rule_statuses: MutableMapping[int, GroupRuleStatus] = {}
    for key, rule in zip(keys, rules):
        rule_status = cache_results.get(key)
        if not rule_status:
            missing_rule_ids.add(rule.id)
        else:
            rule_statuses[rule.id] = rule_status

    if missing_rule_ids:
        # If not cached, attempt to fetch status from the database
        statuses = GroupRuleStatus.objects.filter(group=group, rule_id__in=missing_rule_ids)
        to_cache: list[GroupRuleStatus] = list()
        for status in statuses:
            rule_statuses[status.rule_id] = status
            missing_rule_ids.remove(status.rule_id)
            to_cache.append(status)

        # We might need to create some statuses if they don't already exist
        if missing_rule_ids:
            # We use `ignore_conflicts=True` here to avoid race conditions where the statuses
            # might be created between when we queried above and attempt to create the rows now.
            GroupRuleStatus.objects.bulk_create(
                [
                    GroupRuleStatus(rule_id=rule_id, group=group, project=project)
                    for rule_id in missing_rule_ids
                ],
                ignore_conflicts=True,
            )
            # Using `ignore_conflicts=True` prevents the pk from being set on the model
            # instances. Re-query the database to fetch the rows, they should all exist at this
            # point.
            statuses = GroupRuleStatus.objects.filter(group=group, rule_id__in=missing_rule_ids)
            for status in statuses:
                rule_statuses[status.rule_id] = status
                missing_rule_ids.remove(status.rule_id)
                to_cache.append(status)

            if missing_rule_ids:
                # Shouldn't happen, but log just in case
                logger.error(
                    "Failed to fetch some GroupRuleStatuses in RuleProcessor",
                    extra={"missing_rule_ids": missing_rule_ids, "group_id": group.id},
                )
        if to_cache:
            cache.set_many(
                {build_rule_status_cache_key(item.rule_id, group.id): item for item in to_cache}
            )

    return rule_statuses


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

    for action in rule.data.get("actions", ()):
        action_inst = instantiate_action(rule, action, rule_fire_history)
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


class RuleProcessor:
    def __init__(
        self,
        event: GroupEvent,
        is_new: bool,
        is_regression: bool,
        is_new_group_environment: bool,
        has_reappeared: bool,
        has_escalated: bool = False,
    ) -> None:
        self.event = event
        self.group = event.group
        self.project = event.project

        self.is_new = is_new
        self.is_regression = is_regression
        self.is_new_group_environment = is_new_group_environment
        self.has_reappeared = has_reappeared
        self.has_escalated = has_escalated

        self.grouped_futures: MutableMapping[
            str, tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]
        ] = {}

    def get_rules(self) -> Sequence[Rule]:
        """Get all of the rules for this project from the DB (or cache)."""
        rules_: Sequence[Rule] = Rule.get_for_project(self.project.id)
        return rules_

    def condition_matches(
        self,
        condition: dict[str, Any],
        state: EventState,
        rule: Rule,
    ) -> bool | None:
        condition_cls = rules.get(condition["id"])
        if condition_cls is None:
            logger.warning("Unregistered condition %r", condition["id"])
            return None

        condition_inst = condition_cls(project=self.project, data=condition, rule=rule)
        if not isinstance(condition_inst, (EventCondition, EventFilter)):
            logger.warning("Unregistered condition %r", condition["id"])
            return None
        return safe_execute(condition_inst.passes, self.event, state) or False

    def get_state(self) -> EventState:
        return EventState(
            is_new=self.is_new,
            is_regression=self.is_regression,
            is_new_group_environment=self.is_new_group_environment,
            has_reappeared=self.has_reappeared,
            has_escalated=self.has_escalated,
        )

    def group_conditions_by_speed(
        self, conditions: list[dict[str, Any]]
    ) -> tuple[list[dict[str, str]], list[EventFrequencyConditionData]]:
        fast_conditions = []
        slow_conditions: list[EventFrequencyConditionData] = []

        for condition in conditions:
            if is_condition_slow(condition):
                slow_conditions.append(condition)  # type: ignore[arg-type]
            else:
                fast_conditions.append(condition)

        return fast_conditions, slow_conditions

    def enqueue_rule(self, rule: Rule) -> None:
        if random.random() < 0.01:
            logger.info(
                "rule_processor.rule_enqueued",
                extra={"rule": rule.id, "group": self.group.id, "project": rule.project.id},
            )
        buffer.backend.push_to_sorted_set(PROJECT_ID_BUFFER_LIST_KEY, rule.project.id)

        value = json.dumps(
            {"event_id": self.event.event_id, "occurrence_id": self.event.occurrence_id}
        )
        buffer.backend.push_to_hash(
            model=Project,
            filters={"project_id": rule.project.id},
            field=f"{rule.id}:{self.group.id}",
            value=value,
        )
        metrics.incr("delayed_rule.group_added")

    def apply_rule(self, rule: Rule, status: GroupRuleStatus) -> None:
        """
        If all conditions and filters pass, execute every action.

        :param rule: `Rule` object
        :return: void
        """
        logging_details = {
            "rule_id": rule.id,
            "group_id": self.group.id,
            "event_id": self.event.event_id,
            "project_id": self.project.id,
            "is_new": self.is_new,
            "is_regression": self.is_regression,
            "has_reappeared": self.has_reappeared,
            "has_escalated": self.has_escalated,
            "new_group_environment": self.is_new_group_environment,
        }

        condition_match = rule.data.get("action_match") or Rule.DEFAULT_CONDITION_MATCH
        filter_match = rule.data.get("filter_match") or Rule.DEFAULT_FILTER_MATCH
        frequency = rule.data.get("frequency") or Rule.DEFAULT_FREQUENCY
        try:
            environment = self.event.get_environment()
        except Environment.DoesNotExist:
            return

        if rule.environment_id is not None and environment.id != rule.environment_id:
            return

        now = timezone.now()
        freq_offset = now - timedelta(minutes=frequency)
        if status.last_active and status.last_active > freq_offset:
            return

        state = self.get_state()
        condition_list, filter_list = split_conditions_and_filters(rule.data.get("conditions", ()))
        fast_conditions, slow_conditions = self.group_conditions_by_speed(condition_list)
        condition_list = fast_conditions

        # evaluate all filters and return if they fail, then do the enqueue logic for conditions
        if filter_list:
            predicate_iter = (self.condition_matches(f, state, rule) for f in filter_list)
            predicate_func = get_match_function(filter_match)
            if predicate_func:
                if not predicate_func(predicate_iter):
                    return
            else:
                log_string = f"Unsupported filter_match {filter_match} for rule {rule.id}"
                logger.error(
                    log_string,
                    filter_match,
                    rule.id,
                    extra={**logging_details},
                )
                return

        predicate_func = get_match_function(condition_match)
        if not predicate_func and (slow_conditions or fast_conditions):
            log_string = f"Unsupported condition_match {condition_match} for rule {rule.id}"
            logger.error(
                log_string,
                filter_match,
                rule.id,
                extra={**logging_details},
            )
            return

        if slow_conditions or fast_conditions:
            predicate_iter = (self.condition_matches(f, state, rule) for f in condition_list)
            result = False
            if predicate_func:
                result = predicate_func(predicate_iter)

            if condition_match == "any":
                if not result and slow_conditions:
                    self.enqueue_rule(rule)
                    return
                elif not result:
                    return

            elif condition_match == "all":
                if not result:
                    return

                if slow_conditions:
                    self.enqueue_rule(rule)
                    return

        updated = (
            GroupRuleStatus.objects.filter(id=status.id)
            .exclude(last_active__gt=freq_offset)
            .update(last_active=now)
        )

        if not updated:
            return

        if randrange(10) == 0:
            analytics.record(
                "issue_alert.fired",
                issue_id=self.group.id,
                project_id=rule.project.id,
                organization_id=rule.project.organization.id,
                rule_id=rule.id,
            )
        notification_uuid = str(uuid.uuid4())
        rule_fire_history = history.record(rule, self.group, self.event.event_id, notification_uuid)
        grouped_futures = activate_downstream_actions(
            rule, self.event, notification_uuid, rule_fire_history
        )

        if not self.grouped_futures:
            self.grouped_futures = grouped_futures
        else:
            self.grouped_futures.update(grouped_futures)

    def apply(
        self,
    ) -> Collection[tuple[Callable[[GroupEvent, Sequence[RuleFuture]], None], list[RuleFuture]]]:
        # we should only apply rules on unresolved issues
        if not self.event.group.is_unresolved():
            return {}.values()

        self.grouped_futures.clear()
        rules = self.get_rules()
        snoozed_rules = RuleSnooze.objects.filter(rule__in=rules, user_id=None).values_list(
            "rule", flat=True
        )
        rule_statuses = bulk_get_rule_status(rules, self.group, self.project)
        for rule in rules:
            if rule.id not in snoozed_rules:
                self.apply_rule(rule, rule_statuses[rule.id])

        return self.grouped_futures.values()
