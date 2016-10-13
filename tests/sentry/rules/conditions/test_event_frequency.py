from __future__ import absolute_import

import itertools
import pytz
from datetime import datetime, timedelta

import mock
import six

from sentry.app import tsdb
from sentry.rules.conditions.event_frequency import (
    EventFrequencyCondition, EventUniqueUserFrequencyCondition, Interval
)
from sentry.testutils.cases import RuleTestCase


class FrequencyConditionMixin(object):
    def increment(self, event, count, timestamp=None):
        raise NotImplementedError

    @mock.patch('django.utils.timezone.now')
    def test_one_minute(self, now):
        now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_MINUTE,
            'value': six.text_type(value),
        })

        self.increment(
            event,
            value + 1,
            timestamp=now() - timedelta(minutes=5),
        )
        self.assertDoesNotPass(rule, event)

        self.increment(event, value)
        self.assertDoesNotPass(rule, event)

        self.increment(event, 1)

        self.assertPasses(rule, event)

    @mock.patch('django.utils.timezone.now')
    def test_one_hour(self, now):
        now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_HOUR,
            'value': six.text_type(value),
        })

        self.increment(
            event,
            value + 1,
            timestamp=now() - timedelta(minutes=90),
        )
        self.assertDoesNotPass(rule, event)

        self.increment(event, value)
        self.assertDoesNotPass(rule, event)

        self.increment(event, 1)

        self.assertPasses(rule, event)

    @mock.patch('django.utils.timezone.now')
    def test_one_day(self, now):
        now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        value = 10
        rule = self.get_rule({
            'interval': Interval.ONE_DAY,
            'value': six.text_type(value),
        })

        self.increment(
            event,
            value + 1,
            timestamp=now() - timedelta(hours=36),
        )
        self.assertDoesNotPass(rule, event)

        self.increment(event, value)
        self.assertDoesNotPass(rule, event)

        self.increment(event, 1)

        self.assertPasses(rule, event)

    @mock.patch('django.utils.timezone.now')
    def test_more_than_zero(self, now):
        now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        rule = self.get_rule({
            'interval': Interval.ONE_MINUTE,
            'value': six.text_type('0'),
        })

        self.assertDoesNotPass(rule, event)

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
