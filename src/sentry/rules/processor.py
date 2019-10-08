from __future__ import absolute_import

import logging
import six

from collections import namedtuple
from datetime import timedelta
from django.core.cache import cache
from django.utils import timezone

from sentry.models import GroupRuleStatus, Rule
from sentry.rules import EventState, rules
from sentry.utils.hashlib import hash_values
from sentry.utils.safe import safe_execute

RuleFuture = namedtuple("RuleFuture", ["rule", "kwargs"])


# TODO(dcramer): come up with a clean way to kill this either by renaming
# the Event.message attribute or updating all plugins (former is better)
class EventCompatibilityProxy(object):
    """
    A proxy which manages the 'message' attribute on an event to safely
    upgrade legacy notifications.
    """

    __class__ = property(lambda x: x._event.__class__)

    # TODO: this goes away once message has been renamed to search_message
    # and real_message to message

    def __init__(self, event):
        self._event = event

    def __getattr__(self, attr):
        return getattr(self._event, attr)

    @property
    def message(self):
        return self._event.real_message


class RuleProcessor(object):
    logger = logging.getLogger("sentry.rules")

    def __init__(self, event, is_new, is_regression, is_new_group_environment, has_reappeared):
        self.event = EventCompatibilityProxy(event)
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

    def get_state(self):
        return EventState(
            is_new=self.is_new,
            is_regression=self.is_regression,
            is_new_group_environment=self.is_new_group_environment,
            has_reappeared=self.has_reappeared,
        )

    def apply_rule(self, rule):
        match = rule.data.get("action_match") or Rule.DEFAULT_ACTION_MATCH
        condition_list = rule.data.get("conditions", ())
        frequency = rule.data.get("frequency") or Rule.DEFAULT_FREQUENCY

        # XXX(dcramer): if theres no condition should we really skip it,
        # or should we just apply it blindly?
        if not condition_list:
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

        condition_iter = (self.condition_matches(c, state, rule) for c in condition_list)

        if match == "all":
            passed = all(condition_iter)
        elif match == "any":
            passed = any(condition_iter)
        elif match == "none":
            passed = not any(condition_iter)
        else:
            self.logger.error("Unsupported action_match %r for rule %d", match, rule.id)
            return

        if passed:
            passed = (
                GroupRuleStatus.objects.filter(id=status.id)
                .exclude(last_active__gt=freq_offset)
                .update(last_active=now)
            )

        if not passed:
            return

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
        self.grouped_futures.clear()
        for rule in self.get_rules():
            self.apply_rule(rule)
        return six.itervalues(self.grouped_futures)
