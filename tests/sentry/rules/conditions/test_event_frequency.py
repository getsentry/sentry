from __future__ import absolute_import

import itertools
import pytz
from datetime import datetime, timedelta

from sentry.utils.compat import mock
import six

from sentry import tsdb
from sentry.models import Rule
from sentry.rules.conditions.event_frequency import (
    EventFrequencyCondition,
    EventUniqueUserFrequencyCondition,
)
from sentry.testutils.cases import RuleTestCase
from six.moves import xrange


class FrequencyConditionMixin(object):
    def increment(self, event, count, timestamp=None):
        raise NotImplementedError

    @mock.patch("django.utils.timezone.now")
    def test_one_minute(self, now):
        now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        value = 10
        data = {"interval": "1m", "value": six.text_type(value)}

        rule = self.get_rule(data=data, rule=Rule(environment_id=None))

        environment_id = 1
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=environment_id))

        self.increment(
            event, value + 1, environment_id=environment_id, timestamp=now() - timedelta(minutes=5)
        )
        self.assertDoesNotPass(rule, event)
        self.assertDoesNotPass(environment_rule, event)

        self.increment(event, value, environment_id=environment_id)
        self.assertDoesNotPass(rule, event)
        self.assertDoesNotPass(environment_rule, event)

        self.increment(event, 1, environment_id=environment_id)
        self.assertPasses(rule, event)
        self.assertPasses(environment_rule, event)
        self.assertDoesNotPass(self.get_rule(data=data, rule=Rule(environment_id=0)), event)

    @mock.patch("django.utils.timezone.now")
    def test_one_hour(self, now):
        now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        value = 10
        data = {"interval": "1h", "value": six.text_type(value)}

        rule = self.get_rule(data=data, rule=Rule(environment_id=None))

        environment_id = 1
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=environment_id))

        self.increment(
            event, value + 1, environment_id=environment_id, timestamp=now() - timedelta(minutes=90)
        )
        self.assertDoesNotPass(rule, event)
        self.assertDoesNotPass(environment_rule, event)

        self.increment(event, value, environment_id=environment_id)
        self.assertDoesNotPass(rule, event)
        self.assertDoesNotPass(environment_rule, event)

        self.increment(event, 1, environment_id=environment_id)
        self.assertPasses(rule, event)
        self.assertPasses(environment_rule, event)
        self.assertDoesNotPass(self.get_rule(data=data, rule=Rule(environment_id=0)), event)

    @mock.patch("django.utils.timezone.now")
    def test_one_day(self, now):
        now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        value = 10
        data = {"interval": "1d", "value": six.text_type(value)}

        rule = self.get_rule(data=data, rule=Rule(environment_id=None))

        environment_id = 1
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=environment_id))

        self.increment(
            event, value + 1, environment_id=environment_id, timestamp=now() - timedelta(hours=36)
        )
        self.assertDoesNotPass(rule, event)
        self.assertDoesNotPass(environment_rule, event)

        self.increment(event, value, environment_id=environment_id)
        self.assertDoesNotPass(rule, event)
        self.assertDoesNotPass(environment_rule, event)

        self.increment(event, 1, environment_id=environment_id)
        self.assertPasses(rule, event)
        self.assertPasses(environment_rule, event)
        self.assertDoesNotPass(self.get_rule(data=data, rule=Rule(environment_id=0)), event)

    @mock.patch("django.utils.timezone.now")
    def test_more_than_zero(self, now):
        now.return_value = datetime(2016, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        data = {"interval": "1m", "value": six.text_type("0")}

        rule = self.get_rule(data=data, rule=Rule(environment_id=None))

        environment_id = 1
        environment_rule = self.get_rule(data=data, rule=Rule(environment_id=environment_id))

        self.assertDoesNotPass(rule, event)
        self.assertDoesNotPass(environment_rule, event)

        self.increment(event, 1, environment_id=environment_id)

        self.assertPasses(rule, event)
        self.assertPasses(environment_rule, event)
        self.assertDoesNotPass(self.get_rule(data=data, rule=Rule(environment_id=0)), event)


class EventFrequencyConditionTestCase(FrequencyConditionMixin, RuleTestCase):
    rule_cls = EventFrequencyCondition

    def increment(self, event, count, environment_id, timestamp=None):
        tsdb.incr(
            tsdb.models.group,
            event.group_id,
            count=count,
            environment_id=environment_id,
            timestamp=timestamp,
        )


class EventUniqueUserFrequencyConditionTestCase(FrequencyConditionMixin, RuleTestCase):
    rule_cls = EventUniqueUserFrequencyCondition

    sequence = itertools.count()  # generates unique values, class scope doesn't matter

    def increment(self, event, count, environment_id, timestamp=None):
        tsdb.record(
            tsdb.models.users_affected_by_group,
            event.group_id,
            [next(self.sequence) for _ in xrange(0, count)],
            environment_id=environment_id,
            timestamp=timestamp,
        )
