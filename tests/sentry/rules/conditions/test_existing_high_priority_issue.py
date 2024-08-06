from sentry.models.rule import Rule
from sentry.rules.conditions.existing_high_priority_issue import ExistingHighPriorityIssueCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel

pytestmark = [requires_snuba]


class ExistingHighPriorityIssueConditionTest(RuleTestCase):
    rule_cls = ExistingHighPriorityIssueCondition

    def setUp(self):
        self.rule = Rule(environment_id=1, project=self.project, label="label")

    @with_feature("organizations:priority-ga-features")
    def test_applies_correctly(self):
        rule = self.get_rule(rule=self.rule)

        # This will never pass for non-new or non-escalating issuesalways pass
        self.event.group.update(priority=PriorityLevel.HIGH)
        self.assertPasses(rule, is_new=False, has_reappeared=True, has_escalated=False)
        self.assertPasses(rule, is_new=False, has_reappeared=False, has_escalated=True)

        # This will never pass
        self.assertDoesNotPass(rule, is_new=True, has_reappeared=False, has_escalated=True)
        self.assertDoesNotPass(rule, is_new=True, has_reappeared=True, has_escalated=False)

        self.event.group.update(priority=PriorityLevel.LOW)
        self.assertDoesNotPass(rule, is_new=False, has_reappeared=True, has_escalated=False)

        self.event.group.update(priority=PriorityLevel.MEDIUM)
        self.assertDoesNotPass(rule, is_new=False, has_reappeared=True, has_escalated=True)
