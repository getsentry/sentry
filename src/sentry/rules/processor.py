import logging
from datetime import timedelta
from random import randrange
from typing import Mapping, Sequence, Set

from django.core.cache import cache
from django.utils import timezone

from sentry import analytics
from sentry.models import GroupRuleStatus, Rule
from sentry.rules import EventState, RuleFuture, history, rules
from sentry.utils.hashlib import hash_values
from sentry.utils.safe import safe_execute

SLOW_CONDITION_MATCHES = ["event_frequency"]


class RuleProcessor:
    logger = logging.getLogger("sentry.rules")

    def __init__(self, event, is_new, is_regression, is_new_group_environment, has_reappeared):
        self.event = event
        self.group = event.group
        self.project = event.project

        self.is_new = is_new
        self.is_regression = is_regression
        self.is_new_group_environment = is_new_group_environment
        self.has_reappeared = has_reappeared

        self.grouped_futures = {}

    def get_rules(self):
        """
        Get all of the rules for this project from the DB (or cache).

        :return: a list of `Rule`s
        """
        return Rule.get_for_project(self.project.id)

    def _build_rule_status_cache_key(self, rule_id: int) -> str:
        return "grouprulestatus:1:%s" % hash_values([self.group.id, rule_id])

    def bulk_get_rule_status(self, rules: Sequence[Rule]) -> Mapping[int, GroupRuleStatus]:
        keys = [self._build_rule_status_cache_key(rule.id) for rule in rules]
        cache_results: Mapping[str, GroupRuleStatus] = cache.get_many(keys)
        missing_rule_ids: Set[int] = set()
        rule_statuses: Mapping[int, GroupRuleStatus] = {}
        for key, rule in zip(keys, rules):
            rule_status = cache_results.get(key)
            if not rule_status:
                missing_rule_ids.add(rule.id)
            else:
                rule_statuses[rule.id] = rule_status

        if missing_rule_ids:
            # If not cached, attempt to fetch status from the database
            statuses = GroupRuleStatus.objects.filter(
                group=self.group, rule_id__in=missing_rule_ids
            )
            to_cache: Sequence[GroupRuleStatus] = list()
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
                        GroupRuleStatus(rule_id=rule_id, group=self.group, project=self.project)
                        for rule_id in missing_rule_ids
                    ],
                    ignore_conflicts=True,
                )
                # Using `ignore_conflicts=True` prevents the pk from being set on the model
                # instances. Re-query the database to fetch the rows, they should all exist at this
                # point.
                statuses = GroupRuleStatus.objects.filter(
                    group=self.group, rule_id__in=missing_rule_ids
                )
                for status in statuses:
                    rule_statuses[status.rule_id] = status
                    missing_rule_ids.remove(status.rule_id)
                    to_cache.append(status)

                if missing_rule_ids:
                    # Shouldn't happen, but log just in case
                    self.logger.error(
                        "Failed to fetch some GroupRuleStatuses in RuleProcessor",
                        extra={"missing_rule_ids": missing_rule_ids, "group_id": self.group.id},
                    )
            if to_cache:
                cache.set_many(
                    {self._build_rule_status_cache_key(item.rule_id): item for item in to_cache}
                )

        return rule_statuses

    def condition_matches(self, condition, state, rule):
        condition_cls = rules.get(condition["id"])
        if condition_cls is None:
            self.logger.warning("Unregistered condition %r", condition["id"])
            return

        condition_inst = condition_cls(self.project, data=condition, rule=rule)
        return safe_execute(condition_inst.passes, self.event, state, _with_transaction=False)

    def get_rule_type(self, condition):
        rule_cls = rules.get(condition["id"])
        if rule_cls is None:
            self.logger.warning("Unregistered condition or filter %r", condition["id"])
            return

        return rule_cls.rule_type

    def get_state(self):
        return EventState(
            is_new=self.is_new,
            is_regression=self.is_regression,
            is_new_group_environment=self.is_new_group_environment,
            has_reappeared=self.has_reappeared,
        )

    def get_match_function(self, match_name):
        if match_name == "all":
            return all
        elif match_name == "any":
            return any
        elif match_name == "none":
            return lambda bool_iter: not any(bool_iter)
        return None

    def apply_rule(self, rule, status):
        """
        If all conditions and filters pass, execute every action.

        :param rule: `Rule` object
        :return: void
        """
        condition_match = rule.data.get("action_match") or Rule.DEFAULT_CONDITION_MATCH
        filter_match = rule.data.get("filter_match") or Rule.DEFAULT_FILTER_MATCH
        rule_condition_list = rule.data.get("conditions", ())
        frequency = rule.data.get("frequency") or Rule.DEFAULT_FREQUENCY

        if (
            rule.environment_id is not None
            and self.event.get_environment().id != rule.environment_id
        ):
            return

        now = timezone.now()
        freq_offset = now - timedelta(minutes=frequency)
        if status.last_active and status.last_active > freq_offset:
            return

        state = self.get_state()

        condition_list = []
        filter_list = []
        for rule_cond in rule_condition_list:
            if self.get_rule_type(rule_cond) == "condition/event":
                condition_list.append(rule_cond)
            else:
                filter_list.append(rule_cond)

        # Sort `condition_list` so that most expensive conditions run last.
        condition_list.sort(
            key=lambda condition: any(
                condition_match in condition["id"] for condition_match in SLOW_CONDITION_MATCHES
            )
        )

        for predicate_list, match, name in (
            (filter_list, filter_match, "filter"),
            (condition_list, condition_match, "condition"),
        ):
            if not predicate_list:
                continue
            predicate_iter = (self.condition_matches(f, state, rule) for f in predicate_list)
            predicate_func = self.get_match_function(match)
            if predicate_func:
                if not predicate_func(predicate_iter):
                    return
            else:
                self.logger.error(
                    f"Unsupported {name}_match {match!r} for rule {rule.id}", filter_match, rule.id
                )
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

        history.record(rule, self.group)

        for action in rule.data.get("actions", ()):
            action_cls = rules.get(action["id"])
            if action_cls is None:
                self.logger.warning("Unregistered action %r", action["id"])
                continue

            action_inst = action_cls(self.project, data=action, rule=rule)
            results = safe_execute(
                action_inst.after, event=self.event, state=state, _with_transaction=False
            )
            if results is None:
                self.logger.warning("Action %s did not return any futures", action["id"])
                continue

            for future in results:
                key = future.key if future.key is not None else future.callback
                rule_future = RuleFuture(rule=rule, kwargs=future.kwargs)

                if key not in self.grouped_futures:
                    self.grouped_futures[key] = (future.callback, [rule_future])
                else:
                    self.grouped_futures[key][1].append(rule_future)

    def apply(self):
        # we should only apply rules on unresolved issues
        if not self.event.group.is_unresolved():
            return {}.values()

        self.grouped_futures.clear()
        rules = self.get_rules()
        rule_statuses = self.bulk_get_rule_status(rules)
        for rule in rules:
            self.apply_rule(rule, rule_statuses[rule.id])
        return self.grouped_futures.values()
