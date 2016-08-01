from __future__ import absolute_import

import itertools
from datetime import timedelta

from django.utils import timezone

from sentry.app import tsdb
from sentry.rules.conditions.event_frequency import (
    EventFrequencyCondition, EventUniqueUserFrequencyCondition, Interval
)
from sentry.testutils.cases import RuleTestCase


class FrequencyConditionMixin(object):
    def increment(self, event, count, timestamp=None):
        raise NotImplementedError

    def test_one_minute(self):
        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_MINUTE,
            'value': str(value),
        })

        self.increment(
            event,
            value + 1,
            timestamp=timezone.now() - timedelta(minutes=5),
        )

        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        self.increment(event, value)
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        self.increment(event, 1)
        self.assertPasses(rule, event)

    def test_one_hour(self):
        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_HOUR,
            'value': str(value),
        })

        self.increment(
            event,
            value + 1,
            timestamp=timezone.now() - timedelta(minutes=90),
        )
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        self.increment(event, value)
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        self.increment(event, 1)
        self.assertPasses(rule, event)

    def test_one_day(self):
        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_DAY,
            'value': str(value),
        })

        self.increment(
            event,
            value + 1,
            timestamp=timezone.now() - timedelta(hours=36),
        )
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        self.increment(event, value)
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        self.increment(event, 1)
        self.assertPasses(rule, event)

    def test_doesnt_send_consecutive(self):
        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_HOUR,
            'value': str(value),
        })

        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        self.increment(event, value + 1)
        self.assertPasses(rule, event)

        self.assertDoesNotPass(rule, event, rule_last_active=timezone.now())

    def test_more_than_zero(self):
        event = self.get_event()
        rule = self.get_rule({
            'interval': Interval.ONE_MINUTE,
            'value': '0',
        })

        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        self.increment(event, 1)
        self.assertPasses(rule, event)


class EventFrequencyConditionTestCase(FrequencyConditionMixin, RuleTestCase):
    rule_cls = EventFrequencyCondition

    def increment(self, event, count, timestamp=None):
        tsdb.incr(tsdb.models.group, event.group_id, count=count, timestamp=timestamp)


class EventUniqueUserFrequencyConditionTestCase(FrequencyConditionMixin, RuleTestCase):
    rule_cls = EventUniqueUserFrequencyCondition

    sequence = itertools.count()  # generates unique values, class scope doesn't matter

    def increment(self, event, count, timestamp=None):
        tsdb.record(
            tsdb.models.users_affected_by_group,
            event.group_id,
            [next(self.sequence) for _ in xrange(0, count)],
            timestamp=timestamp
        )
