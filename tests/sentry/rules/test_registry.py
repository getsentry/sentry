from sentry.rules import rules
from sentry.rules.base import RuleBase
from sentry.testutils.cases import TestCase


class DummyExcludedRule(RuleBase):
    id = "dummy.exclude"
    rule_type = "dummy"
    should_show_rule = lambda: False  # noqa: E731


class DummyIncludedRule(RuleBase):
    id = "dummy.include"
    rule_type = "dummy"
    should_show_rule = lambda: True  # noqa: E731


class RegistryTest(TestCase):
    def test_included_rule(self):
        rules.add(DummyIncludedRule)

        # Test __iter__
        assert (DummyIncludedRule.rule_type, DummyIncludedRule) in list(rules)
        # Test get
        assert rules.get(DummyIncludedRule.id) is DummyIncludedRule
        # Test __contains__
        assert DummyIncludedRule.id in rules

    def test_excluded_rule(self):
        rules.add(DummyExcludedRule)

        # Test __iter__
        for rule in rules:
            assert rule is not DummyExcludedRule
        # Test get
        assert rules.get(DummyExcludedRule.id) is None
        # Test __contains__
        assert DummyExcludedRule.id not in rules
