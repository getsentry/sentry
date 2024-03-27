from sentry.rules.conditions.high_priority_issue import HighPriorityIssueCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel

pytestmark = [requires_snuba]


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

    @with_feature("projects:high-priority-alerts")
    @with_feature("projects:issue-priority")
    def test_applies_correctly_with_priority(self):
        rule = self.get_rule()
        event = self.get_event()

        # This will never pass for non-new or non-escalating issuesalways pass
        event.group.update(priority=PriorityLevel.HIGH)
        self.assertPasses(rule, event, is_new=True, has_reappeared=False, has_escalated=False)
        self.assertPasses(rule, event, is_new=False, has_reappeared=True, has_escalated=False)
        self.assertPasses(rule, event, is_new=False, has_reappeared=True, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=False, has_escalated=False)

        # This will never pass
        event.group.update(priority=PriorityLevel.LOW)
        self.assertDoesNotPass(rule, event, is_new=True, has_reappeared=False, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=True, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=True, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=False, has_escalated=False)

        # This will never pass
        event.group.update(priority=PriorityLevel.MEDIUM)
        self.assertDoesNotPass(rule, event, is_new=True, has_reappeared=False, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=True, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=True, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=False, has_escalated=False)
