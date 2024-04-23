from sentry.models.rule import Rule
from sentry.rules.conditions.high_priority_issue import HighPriorityIssueCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel

pytestmark = [requires_snuba]


class HighPriorityIssueConditionTest(RuleTestCase):
    rule_cls = HighPriorityIssueCondition

    def setUp(self):
        self.rule = Rule(environment_id=1, project=self.project, label="label")

    def test_without_flag(self):
        rule = self.get_rule(rule=self.rule)

        self.assertDoesNotPass(rule, self.event, is_new=False)
        self.assertDoesNotPass(rule, self.event, is_new=True)

    @with_feature("projects:high-priority-alerts")
    def test_without_threshold_and_environment(self):
        self.rule.environment_id = None
        self.rule.save()
        rule = self.get_rule(rule=self.rule)

        self.assertPasses(rule, self.event, is_new=True)
        self.assertPasses(rule, self.event, is_new=True)
        self.assertDoesNotPass(rule, self.event, is_new=False)
        self.assertDoesNotPass(rule, self.event, is_new=False)

    @with_feature("projects:high-priority-alerts")
    def test_without_threshold_with_environment(self):
        rule = self.get_rule(rule=self.rule)

        self.assertPasses(rule, self.event, is_new=True, is_new_group_environment=True)
        self.assertPasses(rule, self.event, is_new=False, is_new_group_environment=True)
        self.assertPasses(rule, self.event, is_new=False, is_new_group_environment=True)

        self.assertDoesNotPass(rule, self.event, is_new=True, is_new_group_environment=False)
        self.assertDoesNotPass(rule, self.event, is_new=False, is_new_group_environment=False)
        self.assertDoesNotPass(
            rule, self.event, is_new=False, is_new_group_environment=False, has_escalated=True
        )

    @with_feature("projects:high-priority-alerts")
    @with_feature("projects:issue-priority")
    def test_with_threshold_and_priority(self):
        self.project.flags.has_high_priority_alerts = True
        self.project.save()

        rule = self.get_rule(rule=self.rule)

        # This will only pass for new or escalating issues
        self.event.group.update(priority=PriorityLevel.HIGH)
        self.assertPasses(rule, self.event, is_new=True, has_reappeared=False)
        self.assertPasses(rule, self.event, is_new=False, has_reappeared=True)
        self.assertPasses(rule, self.event, is_new=False, has_reappeared=False, has_escalated=True)
        self.assertDoesNotPass(rule, self.event, is_new=False, has_reappeared=False)

        # This will never pass
        self.event.group.update(priority=PriorityLevel.LOW)
        self.assertDoesNotPass(rule, self.event, is_new=True)
        self.assertDoesNotPass(rule, self.event, is_new=False, has_escalated=True)

        # This will never pass
        self.event.group.update(priority=PriorityLevel.MEDIUM)
        self.assertDoesNotPass(rule, self.event, is_new=True)
        self.assertDoesNotPass(rule, self.event, is_new=False, has_escalated=True)
