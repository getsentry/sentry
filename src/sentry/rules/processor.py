from __future__ import absolute_import

import logging
import six

from collections import namedtuple
from datetime import timedelta
from django.core.cache import cache
from django.utils import timezone
from random import randrange

from sentry import analytics
from sentry.models import GroupRuleStatus, Rule
from sentry.rules import EventState, rules
from sentry.utils.hashlib import hash_values
from sentry.utils.safe import safe_execute

RuleFuture = namedtuple("RuleFuture", ["rule", "kwargs"])


class RuleProcessor(object):
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
        return Rule.get_for_project(self.project.id)

    def get_rule_status(self, rule):
        key = "grouprulestatus:1:%s" % hash_values([self.group.id, rule.id])
        rule_status = cache.get(key)
        if rule_status is None:
            rule_status, _ = GroupRuleStatus.objects.get_or_create(
                rule=rule, group=self.group, defaults={"project": self.project}
            )
            cache.set(key, rule_status, 300)
        return rule_status

    def condition_matches(self, condition, state, rule):
        condition_cls = rules.get(condition["id"])
        if condition_cls is None:
            self.logger.warn("Unregistered condition %r", condition["id"])
            return

        condition_inst = condition_cls(self.project, data=condition, rule=rule)
        return safe_execute(condition_inst.passes, self.event, state, _with_transaction=False)

    def get_rule_type(self, condition):
        rule_cls = rules.get(condition["id"])
        if rule_cls is None:
            self.logger.warn("Unregistered condition or filter %r", condition["id"])
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

    def apply_rule(self, rule):
        condition_match = rule.data.get("action_match") or Rule.DEFAULT_CONDITION_MATCH
        filter_match = rule.data.get("filter_match") or Rule.DEFAULT_FILTER_MATCH
        rule_condition_list = rule.data.get("conditions", ())
        frequency = rule.data.get("frequency") or Rule.DEFAULT_FREQUENCY

        # XXX(dcramer): if theres no condition should we really skip it,
        # or should we just apply it blindly?
        if not rule_condition_list:
            return

        if (
            rule.environment_id is not None
            and self.event.get_environment().id != rule.environment_id
        ):
            return

        status = self.get_rule_status(rule)

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

        if not condition_list:
            return

        condition_iter = (self.condition_matches(c, state, rule) for c in condition_list)
        filter_iter = (self.condition_matches(f, state, rule) for f in filter_list)

        condition_func = self.get_match_function(condition_match)
        if condition_func:
            condition_passed = condition_func(condition_iter)
        else:
            self.logger.error(
                "Unsupported condition_match %r for rule %d", condition_match, rule.id
            )
            return

        if not condition_passed:
            return

        filter_func = self.get_match_function(filter_match)
        if filter_func:
            passed = filter_func(filter_iter)
        else:
            self.logger.error("Unsupported filter_match %r for rule %d", filter_match, rule.id)
            return

        if passed:
            passed = (
                GroupRuleStatus.objects.filter(id=status.id)
                .exclude(last_active__gt=freq_offset)
                .update(last_active=now)
            )

        if not passed:
            return

        if randrange(10) == 0:
            analytics.record(
                "issue_alert.fired",
                issue_id=self.group.id,
                project_id=rule.project.id,
                organization_id=rule.project.organization.id,
                rule_id=rule.id,
            )

        for action in rule.data.get("actions", ()):
            action_cls = rules.get(action["id"])
            if action_cls is None:
                self.logger.warn("Unregistered action %r", action["id"])
                continue

            action_inst = action_cls(self.project, data=action, rule=rule)
            results = safe_execute(
                action_inst.after, event=self.event, state=state, _with_transaction=False
            )
            if results is None:
                self.logger.warn("Action %s did not return any futures", action["id"])
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
            return six.itervalues({})

        self.grouped_futures.clear()
        for rule in self.get_rules():
            self.apply_rule(rule)
        return six.itervalues(self.grouped_futures)
