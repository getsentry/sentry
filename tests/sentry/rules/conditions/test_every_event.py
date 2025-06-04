from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class EveryEventConditionTest(RuleTestCase):
    rule_cls = EveryEventCondition

    def test_applies_correctly(self):
        rule = self.get_rule()

        self.assertPasses(rule, self.event, is_new=True)
        self.assertPasses(rule, self.event, is_new=False)
