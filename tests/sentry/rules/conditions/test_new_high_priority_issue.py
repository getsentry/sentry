from sentry.models.rule import Rule
from sentry.rules.conditions.new_high_priority_issue import NewHighPriorityIssueCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel

pytestmark = [requires_snuba]


class NewHighPriorityIssueConditionTest(RuleTestCase):
    rule_cls = NewHighPriorityIssueCondition

    def setUp(self):
        self.rule = Rule(environment_id=1, project=self.project, label="label")

    @with_feature("projects:high-priority-alerts")
    @with_feature("projects:issue-priority")
    def test_applies_correctly(self):
        rule = self.get_rule(rule=self.rule)

        # This will only pass for new issues
        self.event.group.update(priority=PriorityLevel.HIGH)
        self.assertPasses(rule, is_new_group_environment=True)
        self.assertPasses(rule, is_new_group_environment=True, has_reappeared=False)

        # These will never pass
        self.assertDoesNotPass(rule, is_new_group_environment=False)

        self.event.group.update(priority=PriorityLevel.MEDIUM)
        self.assertDoesNotPass(rule, is_new_group_environment=True)

        self.event.group.update(priority=PriorityLevel.LOW)
        self.assertDoesNotPass(rule, is_new_group_environment=True)
