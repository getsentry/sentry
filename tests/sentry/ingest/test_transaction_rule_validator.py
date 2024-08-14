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


def test_schema_all_stars_invalid():
    assert not RuleValidator(ReplacementRule("http://*/*/*/**")).is_valid()
    assert not RuleValidator(ReplacementRule("https://*/*/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("http://a/*/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("http://example.com/*/*/**")).is_valid()
    assert RuleValidator(
        ReplacementRule("http://user:password@www.example.com:80/*/*/*/**")
    ).is_valid()
    assert RuleValidator(ReplacementRule("ftp:///ftp.example.com/rfcs/*/**")).is_valid()
    assert not RuleValidator(ReplacementRule("ftp://*/*/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("file:///example.txt")).is_valid()
    assert not RuleValidator(ReplacementRule("file:///*/*/**")).is_valid()
