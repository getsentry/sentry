from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.testutils.cases import RuleTestCase


class RegressionEventConditionTest(RuleTestCase):
    rule_cls = RegressionEventCondition

    def test_applies_correctly(self):
        rule = self.get_rule()

        self.assertPasses(rule, self.event, is_regression=True)

        self.assertDoesNotPass(rule, self.event, is_regression=False)
