from sentry.models.rule import Rule
from sentry.rules.conditions.high_priority_issue import HighPriorityIssueCondition
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel

pytestmark = [requires_snuba]


@region_silo_test
class HighPriorityIssueConditionTest(RuleTestCase):
    rule_cls = HighPriorityIssueCondition

    def test_without_flag(self):
        rule = self.get_rule()

        self.assertDoesNotPass(rule, self.event, is_new=False)
        self.assertDoesNotPass(rule, self.event, is_new=True)

    @with_feature("projects:high-priority-alerts")
    def test_without_threshold_and_environment(self):
        rule = self.get_rule(rule=Rule(environment_id=None))

        self.assertPasses(rule, self.event, is_new=True)
        self.assertPasses(rule, self.event, is_new=True)
        self.assertDoesNotPass(rule, self.event, is_new=False)
        self.assertDoesNotPass(rule, self.event, is_new=False)

    @with_feature("projects:high-priority-alerts")
    def test_without_threshold_with_environment(self):
        rule = self.get_rule(rule=Rule(environment_id=1))

        self.assertPasses(rule, self.event, is_new=True, is_new_group_environment=True)
        self.assertPasses(rule, self.event, is_new=False, is_new_group_environment=True)
        self.assertPasses(rule, self.event, is_new=False, is_new_group_environment=True)

        self.assertDoesNotPass(rule, self.event, is_new=True, is_new_group_environment=False)
        self.assertDoesNotPass(rule, self.event, is_new=False, is_new_group_environment=False)
        self.assertDoesNotPass(
            rule, self.event, is_new=False, is_new_group_environment=False, has_escalated=True
        )

    @with_feature("projects:high-priority-alerts")
    def test_with_threshold_without_priority(self):
        rule = self.get_rule(rule=Rule(environment_id=1, data={"new_issue_threshold_met": True}))
        self.event.group.data["metadata"] = {"severity": "0.7"}
        self.assertPasses(rule, self.event, is_new=True, has_reappeared=False)
        self.assertDoesNotPass(rule, self.event, is_new=False, has_reappeared=False)

        self.event.group.data["metadata"] = {"severity": "0.0"}
        self.assertPasses(rule, self.event, is_new=False, has_reappeared=False, has_escalated=True)
        self.assertPasses(rule, self.event, is_new=False, has_reappeared=False, has_escalated=True)
        self.assertDoesNotPass(rule, self.event, is_new=True, has_reappeared=False)

    @with_feature("projects:high-priority-alerts")
    @with_feature("projects:issue-priority")
    def test_with_threshold_and_priority(self):
        rule = self.get_rule(rule=Rule(environment_id=1, data={"new_issue_threshold_met": True}))

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
