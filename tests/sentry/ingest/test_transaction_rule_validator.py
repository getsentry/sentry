from typing import int
from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.ingest.transaction_clusterer.rule_validator import RuleValidator


def test_all_star_rules_invalid() -> None:
    assert not RuleValidator(ReplacementRule("*/**")).is_valid()
    assert not RuleValidator(ReplacementRule("/*/**")).is_valid()

    assert not RuleValidator(ReplacementRule("*/*/*/*/**")).is_valid()
    assert not RuleValidator(ReplacementRule("/*/*/*/*/**")).is_valid()


def test_non_all_star_rules_valid() -> None:
    assert RuleValidator(ReplacementRule("a/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("/a/*/**")).is_valid()

    assert RuleValidator(ReplacementRule("*/a/**")).is_valid()
    assert RuleValidator(ReplacementRule("/*/a/**")).is_valid()

    assert RuleValidator(ReplacementRule("a/*/b/**")).is_valid()
    assert RuleValidator(ReplacementRule("/a/*/b/**")).is_valid()

    assert RuleValidator(ReplacementRule("a/*/b/*/c/**")).is_valid()
    assert RuleValidator(ReplacementRule("/a/*/b/*/c/**")).is_valid()


def test_schema_all_stars_invalid() -> None:
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


def test_http_method_all_stars_invalid() -> None:
    # all star paths prefixed with HTTP methods are invalid
    assert not RuleValidator(ReplacementRule("GET /*/*/**")).is_valid()
    assert not RuleValidator(ReplacementRule("POST /*/*/**")).is_valid()
    assert not RuleValidator(ReplacementRule("get /*/*/**")).is_valid()

    # as long as one segment isn't a *, it's valid
    assert RuleValidator(ReplacementRule("GET /a/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("POST /*/b/**")).is_valid()
    assert RuleValidator(ReplacementRule("get /c/*/**")).is_valid()

    # works for URLs too
    assert not RuleValidator(ReplacementRule("GET http://*/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("GET http://example.com/*/**")).is_valid()

    # unknown HTTP methods aren't considered
    assert RuleValidator(ReplacementRule("FOO /*/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("FOO /a/*/**")).is_valid()

    # works with a "middleware " prefix too (via Next.js SDK)
    assert not RuleValidator(ReplacementRule("middleware GET /*/*/**")).is_valid()
    assert RuleValidator(ReplacementRule("middleware GET /a/*/**")).is_valid()
