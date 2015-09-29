from __future__ import absolute_import

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.level import LevelCondition, LevelMatchType


class LevelConditionTest(RuleTestCase):
    rule_cls = LevelCondition

    def get_event(self):
        event = self.event
        event.group.level = 20
        return event

    def test_equals(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': LevelMatchType.EQUAL,
            'level': '20',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': LevelMatchType.EQUAL,
            'level': '30',
        })
        self.assertDoesNotPass(rule, event)

    def test_greater_than(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': LevelMatchType.GREATER_OR_EQUAL,
            'level': '40',
        })
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule({
            'match': LevelMatchType.GREATER_OR_EQUAL,
            'level': '20',
        })
        self.assertPasses(rule, event)

    def test_less_than(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': LevelMatchType.LESS_OR_EQUAL,
            'level': '10',
        })
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule({
            'match': LevelMatchType.LESS_OR_EQUAL,
            'level': '30',
        })
        self.assertPasses(rule, event)
