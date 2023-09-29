from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.ingest.transaction_clusterer.rule_validator import RuleValidator


def test_all_star_rules_invalid():
    assert not RuleValidator(ReplacementRule("*/**")).is_valid()
    assert not RuleValidator(ReplacementRule("/*/**")).is_valid()

    assert not RuleValidator(ReplacementRule("*/*/*/*/**")).is_valid()
    assert not RuleValidator(ReplacementRule("/*/*/*/*/**")).is_valid()


def test_non_all_star_rules_valid():
    assert RuleValidator(ReplacementRule("a/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("/a/*/**")).is_valid()

    assert RuleValidator(ReplacementRule("*/a/**")).is_valid()
    assert RuleValidator(ReplacementRule("/*/a/**")).is_valid()

    assert RuleValidator(ReplacementRule("a/*/b/**")).is_valid()
    assert RuleValidator(ReplacementRule("/a/*/b/**")).is_valid()

    assert RuleValidator(ReplacementRule("a/*/b/*/c/**")).is_valid()
    assert RuleValidator(ReplacementRule("/a/*/b/*/c/**")).is_valid()
