from __future__ import absolute_import

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.regression_event import RegressionEventCondition


class RegressionEventConditionTest(RuleTestCase):
    rule_cls = RegressionEventCondition

    def test_applies_correctly(self):
        rule = self.get_rule()

        self.assertPasses(rule, self.event, is_regression=True)

        self.assertDoesNotPass(rule, self.event, is_regression=False)
