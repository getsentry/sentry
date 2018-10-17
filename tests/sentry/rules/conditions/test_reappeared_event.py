from __future__ import absolute_import

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition


class ReappearedEventConditionTest(RuleTestCase):
    rule_cls = ReappearedEventCondition

    def test_applies_correctly(self):
        rule = self.get_rule()

        self.assertPasses(rule, self.event, has_reappeared=True)

        self.assertDoesNotPass(rule, self.event, has_reappeared=False)
