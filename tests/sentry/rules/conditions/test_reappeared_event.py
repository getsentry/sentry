from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
class ReappearedEventConditionTest(RuleTestCase):
    rule_cls = ReappearedEventCondition

    def test_applies_correctly(self):
        rule = self.get_rule()

        self.assertPasses(rule, self.event, has_reappeared=True)

        self.assertDoesNotPass(rule, self.event, has_reappeared=False)
