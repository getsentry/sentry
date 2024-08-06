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

    @with_feature("organizations:priority-ga-features")
    def test_applies_correctly_with_high_priority_alerts(self):
        self.project.flags.has_high_priority_alerts = True
        self.project.save()
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

    @with_feature("organizations:priority-ga-features")
    def test_applies_correctly_without_high_priority_alerts(self):
        self.project.flags.has_high_priority_alerts = False
        self.project.save()
        rule = self.get_rule(rule=self.rule)

        self.event.group.update(priority=PriorityLevel.HIGH)
        self.assertPasses(rule, self.event, is_new_group_environment=True)
        self.assertDoesNotPass(rule, self.event, is_new_group_environment=False)

        self.event.group.update(priority=PriorityLevel.MEDIUM)
        self.assertPasses(rule, self.event, is_new_group_environment=True)
        self.assertDoesNotPass(rule, self.event, is_new_group_environment=False)

        self.event.group.update(priority=PriorityLevel.LOW)
        self.assertPasses(rule, self.event, is_new_group_environment=True)
        self.assertDoesNotPass(rule, self.event, is_new_group_environment=False)
