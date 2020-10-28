from __future__ import absolute_import

import pytz
import six
from datetime import datetime, timedelta

from django.utils import timezone

from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.testutils.cases import RuleTestCase
from sentry.utils.compat import mock


class AgeComparisonFilterTest(RuleTestCase):
    rule_cls = AgeComparisonFilter

    @mock.patch("django.utils.timezone.now")
    def test_older_applies_correctly(self, now):
        now.return_value = datetime(2020, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        value = 10
        data = {"comparison_type": "older", "value": six.text_type(value), "time": "hour"}

        rule = self.get_rule(data=data)

        event.group.first_seen = timezone.now() - timedelta(hours=3)
        self.assertDoesNotPass(rule, event)

        event.group.first_seen = timezone.now() - timedelta(hours=11)
        self.assertPasses(rule, event)

    @mock.patch("django.utils.timezone.now")
    def test_newer_applies_correctly(self, now):
        now.return_value = datetime(2020, 8, 1, 0, 0, 0, 0, tzinfo=pytz.utc)

        event = self.get_event()
        value = 10
        data = {"comparison_type": "newer", "value": six.text_type(value), "time": "hour"}

        rule = self.get_rule(data=data)

        event.group.first_seen = timezone.now() - timedelta(hours=3)
        self.assertPasses(rule, event)

        event.group.first_seen = timezone.now() - timedelta(hours=11)
        self.assertDoesNotPass(rule, event)

    def test_fails_on_insufficient_data(self):
        event = self.get_event()

        data = {"time": "hour"}
        rule = self.get_rule(data=data)

        self.assertDoesNotPass(rule, event)

        data = {"value": "bad_value"}
        rule = self.get_rule(data=data)

        self.assertDoesNotPass(rule, event)

        data = {"comparison_type": "bad_value"}
        rule = self.get_rule(data=data)

        self.assertDoesNotPass(rule, event)
