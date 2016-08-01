from __future__ import absolute_import

import logging

from collections import defaultdict, namedtuple
from django.utils import timezone

from sentry.models import GroupRuleStatus, Rule
from sentry.rules import EventState, rules
from sentry.utils.safe import safe_execute

RuleFuture = namedtuple('RuleFuture', ['rule', 'kwargs'])


# TODO(dcramer): come up with a clean way to kill this either by renaming
# the Event.message attribute or updating all plugins (former is better)
class EventCompatibilityProxy(object):
    """
    A proxy which manages the 'message' attribute on an event to safely
    upgrade legacy notifications.
    """
    __class__ = property(lambda x: x._event.__class__)

    def __init__(self, event):
        self._event = event

    def __getattr__(self, attr):
        return getattr(self._event, attr)

    @property
    def message(self):
        return self._event.get_legacy_message()


class RuleProcessor(object):
    logger = logging.getLogger('sentry.rules')

    def __init__(self, event, is_new, is_regression, is_sample):
        self.event = EventCompatibilityProxy(event)
        self.group = event.group
        self.project = event.project

        self.is_new = is_new
        self.is_regression = is_regression
        # TODO(dcramer): lets remove is_sample
        self.is_sample = is_sample

        self.futures_by_cb = defaultdict(list)

    def get_rules(self):
        return Rule.get_for_project(self.project.id)

    def get_rule_status(self, rule):
        # TODO(dcramer): this isnt the most efficient query pattern for this
        rule_status, _ = GroupRuleStatus.objects.get_or_create(
            rule=rule,
            group=self.group,
            defaults={
                'project': self.project,
                'status': GroupRuleStatus.INACTIVE,
            },
        )

        return rule_status

    def condition_matches(self, condition, state, rule):
        condition_cls = rules.get(condition['id'])
        if condition_cls is None:
            self.logger.warn('Unregistered condition %r', condition['id'])
            return

        condition_inst = condition_cls(self.project, data=condition, rule=rule)
        return safe_execute(condition_inst.passes, self.event, state,
                            _with_transaction=False)

    def get_state(self, rule_status):
        return EventState(
            is_new=self.is_new,
            is_regression=self.is_regression,
            is_sample=self.is_sample,
            rule_is_active=rule_status.status == GroupRuleStatus.ACTIVE,
            rule_last_active=rule_status.last_active,
        )

    def apply_rule(self, rule):
        match = rule.data.get('action_match', 'all')
        condition_list = rule.data.get('conditions', ())

        # XXX(dcramer): if theres no condition should we really skip it,
        # or should we just apply it blindly?
        if not condition_list:
            return

        rule_status = self.get_rule_status(rule)
        state = self.get_state(rule_status)

        condition_iter = (
            self.condition_matches(c, state, rule)
            for c in condition_list
        )

        if match == 'all':
            passed = all(condition_iter)
        elif match == 'any':
            passed = any(condition_iter)
        elif match == 'none':
            passed = not any(condition_iter)
        else:
            self.logger.error('Unsupported action_match %r for rule %d',
                              match, rule.id)
            return

        now = timezone.now()
        if passed and rule_status.status == GroupRuleStatus.INACTIVE:
            # we only fire if we're able to say that the state has changed
            GroupRuleStatus.objects.filter(
                id=rule_status.id,
                status=GroupRuleStatus.INACTIVE,
            ).update(
                status=GroupRuleStatus.ACTIVE,
                last_active=now,
            )
            rule_status.last_active = now
            rule_status.status = GroupRuleStatus.ACTIVE
        elif not passed and rule_status.status == GroupRuleStatus.ACTIVE:
            # update the state to suggest this rule can fire again
            GroupRuleStatus.objects.filter(
                id=rule_status.id,
                status=GroupRuleStatus.ACTIVE,
            ).update(status=GroupRuleStatus.INACTIVE)
            rule_status.status = GroupRuleStatus.INACTIVE
        elif passed:
            GroupRuleStatus.objects.filter(
                id=rule_status.id,
                status=GroupRuleStatus.ACTIVE,
            ).update(last_active=now)
            rule_status.last_active = now

        if not passed:
            return

        for action in rule.data.get('actions', ()):
            action_cls = rules.get(action['id'])
            if action_cls is None:
                self.logger.warn('Unregistered action %r', action['id'])
                continue

            action_inst = action_cls(self.project, data=action, rule=rule)
            results = safe_execute(action_inst.after, event=self.event, state=state,
                                   _with_transaction=False)
            if results is None:
                self.logger.warn('Action %s did not return any futures', action['id'])
                continue

            for future in results:
                self.futures_by_cb[future.callback].append(
                    RuleFuture(rule=rule, kwargs=future.kwargs)
                )

    def apply(self):
        self.futures_by_cb = defaultdict(list)
        for rule in self.get_rules():
            self.apply_rule(rule)
        return list(self.futures_by_cb.items())
