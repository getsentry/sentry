from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.app import tsdb
from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.event_frequency import EventFrequencyCondition, Interval


class EventFrequencyConditionTest(RuleTestCase):
    rule_cls = EventFrequencyCondition

    def test_one_minute(self):
        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_MINUTE,
            'value': str(value),
        })

        tsdb.incr(
            tsdb.models.group,
            event.group_id,
            count=value + 1,
            timestamp=timezone.now() - timedelta(minutes=5),
        )
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        tsdb.incr(tsdb.models.group, event.group_id, count=value)
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        tsdb.incr(tsdb.models.group, event.group_id, count=1)
        self.assertPasses(rule, event)

    def test_one_hour(self):
        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_HOUR,
            'value': str(value),
        })

        tsdb.incr(
            tsdb.models.group,
            event.group_id,
            count=value + 1,
            timestamp=timezone.now() - timedelta(minutes=90),
        )
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        tsdb.incr(tsdb.models.group, event.group_id, count=value)
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        tsdb.incr(tsdb.models.group, event.group_id, count=1)
        self.assertPasses(rule, event)

    def test_one_day(self):
        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_DAY,
            'value': str(value),
        })

        tsdb.incr(
            tsdb.models.group,
            event.group_id,
            count=value + 1,
            timestamp=timezone.now() - timedelta(hours=36),
        )
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        tsdb.incr(tsdb.models.group, event.group_id, count=value)
        self.assertDoesNotPass(rule, event)

        rule.clear_cache(event)
        tsdb.incr(tsdb.models.group, event.group_id, count=1)
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
        tsdb.incr(tsdb.models.group, event.group_id, count=value + 1)
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
        tsdb.incr(tsdb.models.group, event.group_id, count=1)
        self.assertPasses(rule, event)
