from __future__ import absolute_import

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition


class FirstSeenEventConditionTest(RuleTestCase):
    rule_cls = FirstSeenEventCondition

    def test_applies_correctly(self):
        rule = self.get_rule()

        self.assertPasses(rule, self.event, is_new=True)

        self.assertDoesNotPass(rule, self.event, is_new=False)
