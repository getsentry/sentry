from sentry.ingest.transaction_clusterer.rule_validator import RuleValidator


def test_all_star_rules_invalid():
    assert not RuleValidator("*/**").is_valid()
    assert not RuleValidator("/*/**").is_valid()

    assert not RuleValidator("*/*/*/*/**").is_valid()
    assert not RuleValidator("/*/*/*/*/**").is_valid()


def test_non_all_star_rules_valid():
    assert RuleValidator("a/*/**").is_valid()
    assert RuleValidator("/a/*/**").is_valid()

    assert RuleValidator("*/a/**").is_valid()
    assert RuleValidator("/*/a/**").is_valid()

    assert RuleValidator("a/*/b/**").is_valid()
    assert RuleValidator("/a/*/b/**").is_valid()

    assert RuleValidator("a/*/b/*/c/**").is_valid()
    assert RuleValidator("/a/*/b/*/c/**").is_valid()
