from __future__ import absolute_import

from sentry.models import Rule
from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition


class FirstSeenEventConditionTest(RuleTestCase):
    rule_cls = FirstSeenEventCondition

    def test_applies_correctly(self):
        rule = self.get_rule(rule=Rule(environment_id=None))

        self.assertPasses(rule, self.event, is_new=True)

        self.assertDoesNotPass(rule, self.event, is_new=False)

    def test_applies_correctly_with_environment(self):
        rule = self.get_rule(rule=Rule(environment_id=1))

        self.assertPasses(rule, self.event, is_new=True, is_new_group_environment=True)
        self.assertPasses(rule, self.event, is_new=False, is_new_group_environment=True)

        self.assertDoesNotPass(rule, self.event, is_new=True, is_new_group_environment=False)
        self.assertDoesNotPass(rule, self.event, is_new=False, is_new_group_environment=False)
