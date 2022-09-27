from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time

from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.testutils.cases import RuleTestCase


class AgeComparisonFilterTest(RuleTestCase):
    rule_cls = AgeComparisonFilter

    @freeze_time()
    def test_older_applies_correctly(self):
        event = self.get_event()
        value = 10
        data = {"comparison_type": "older", "value": str(value), "time": "hour"}

        rule = self.get_rule(data=data)

        event.group.first_seen = timezone.now() - timedelta(hours=3)
        self.assertDoesNotPass(rule, event)

        event.group.first_seen = timezone.now() - timedelta(hours=11)
        self.assertPasses(rule, event)

    @freeze_time()
    def test_newer_applies_correctly(self):
        event = self.get_event()
        value = 10
        data = {"comparison_type": "newer", "value": str(value), "time": "hour"}

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
