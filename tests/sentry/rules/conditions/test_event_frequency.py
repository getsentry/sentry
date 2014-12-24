from sentry.app import tsdb
from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.event_frequency import EventFrequencyCondition, Interval


class EventFrequencyConditionTest(RuleTestCase):
    rule_cls = EventFrequencyCondition

    def test_one_minute(self):
        event = self.get_event()
        rule = self.get_rule({
            'interval': Interval.ONE_MINUTE,
            'value': '10',
        })
        self.assertDoesNotPass(rule, event)

        tsdb.incr(tsdb.models.group, event.group_id, count=11)

        rule.clear_cache(event)

        rule = self.get_rule({
            'interval': Interval.ONE_MINUTE,
            'value': '10',
        })
        self.assertPasses(rule, event)

    def test_one_hour(self):
        event = self.get_event()
        rule = self.get_rule({
            'interval': Interval.ONE_HOUR,
            'value': '10',
        })
        self.assertDoesNotPass(rule, event)

        tsdb.incr(tsdb.models.group, event.group_id, count=11)

        rule.clear_cache(event)

        rule = self.get_rule({
            'interval': Interval.ONE_HOUR,
            'value': '10',
        })
        self.assertPasses(rule, event)
