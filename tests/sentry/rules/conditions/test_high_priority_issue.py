from sentry.rules.conditions.high_priority_issue import HighPriorityIssueCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
class HighPriorityIssueConditionTest(RuleTestCase):
    rule_cls = HighPriorityIssueCondition

    @with_feature("projects:high-priority-alerts")
    def test_applies_correctly(self):
        rule = self.get_rule()
        event = self.get_event()

        self.assertPasses(rule, event, has_reappeared=True, has_escalated=False)
        self.assertPasses(rule, event, has_reappeared=False, has_escalated=True)
        self.assertDoesNotPass(rule, event, has_reappeared=False, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=False, has_escalated=False)

        event.group.data["metadata"] = {"severity": "0.7"}
        self.assertPasses(rule, event, is_new=True, has_reappeared=False, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=False, has_escalated=False)

        event.group.data["metadata"] = {"severity": "0.0"}
        self.assertPasses(rule, event, is_new=False, has_reappeared=False, has_escalated=True)
        self.assertPasses(rule, event, is_new=False, has_reappeared=False, has_escalated=True)
        self.assertDoesNotPass(rule, event, is_new=True, has_reappeared=False, has_escalated=False)
