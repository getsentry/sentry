from datetime import datetime, timedelta, timezone

from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class AgeComparisonFilterTest(RuleTestCase):
    rule_cls = AgeComparisonFilter

    @freeze_time(datetime.now().replace(hour=0, minute=0, second=0, microsecond=0))
    def test_older_applies_correctly(self):
        event = self.get_event()
        value = 10
        data = {"comparison_type": "older", "value": str(value), "time": "hour"}

        rule = self.get_rule(data=data)

        event.group.first_seen = datetime.now(timezone.utc) - timedelta(hours=3)
        self.assertDoesNotPass(rule, event)

        event.group.first_seen = datetime.now(timezone.utc) - timedelta(hours=10, microseconds=1)
        # this needs to be offset by 1ms otherwise it's exactly the same time as "now" and won't pass
        self.assertPasses(rule, event)

    @freeze_time(datetime.now().replace(hour=0, minute=0, second=0, microsecond=0))
    def test_newer_applies_correctly(self):
        event = self.get_event()
        value = 10
        data = {"comparison_type": "newer", "value": str(value), "time": "hour"}

        rule = self.get_rule(data=data)

        event.group.first_seen = datetime.now(timezone.utc) - timedelta(hours=3)
        self.assertPasses(rule, event)

        event.group.first_seen = datetime.now(timezone.utc) - timedelta(hours=10)
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
