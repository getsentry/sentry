from sentry.rules.conditions.existing_high_priority_issue import ExistingHighPriorityIssueCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel

pytestmark = [requires_snuba]


class ExistingHighPriorityIssueConditionTest(RuleTestCase):
    rule_cls = ExistingHighPriorityIssueCondition

    @with_feature("projects:high-priority-alerts")
    @with_feature("projects:issue-priority")
    def test_applies_correctly(self):
        rule = self.get_rule()
        event = self.get_event()

        # This will never pass for non-new or non-escalating issuesalways pass
        event.group.update(priority=PriorityLevel.HIGH)
        self.assertPasses(rule, event, is_new=False, has_reappeared=True, has_escalated=False)

        # This will never pass
        self.assertDoesNotPass(rule, event, is_new=True, has_reappeared=False, has_escalated=False)
        self.assertDoesNotPass(rule, event, is_new=True, has_reappeared=True, has_escalated=False)

        event.group.update(priority=PriorityLevel.LOW)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=True, has_escalated=False)

        event.group.update(priority=PriorityLevel.MEDIUM)
        self.assertDoesNotPass(rule, event, is_new=False, has_reappeared=True, has_escalated=False)
