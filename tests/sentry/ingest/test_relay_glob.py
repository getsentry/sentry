import re

import pytest

from sentry.ingest.relay_glob import GlobShape, InvalidGlobPattern, parse_glob


@pytest.mark.parametrize(
    ("pattern", "expected"),
    [
        pytest.param("/health", GlobShape(complexity=0, specific=True), id="literal"),
        pytest.param("*/health*", GlobShape(complexity=0, specific=True), id="wildcards"),
        pytest.param("*/health{/,}", GlobShape(complexity=2, specific=True), id="default_list"),
        pytest.param("{a,b}/{c,d,e}", GlobShape(complexity=6, specific=True), id="product"),
        pytest.param("{}foo", GlobShape(complexity=1, specific=True), id="empty_group"),
        pytest.param("*[a-z]*", GlobShape(complexity=0, specific=False), id="class"),
        pytest.param("[!a-c-e]x", GlobShape(complexity=0, specific=True), id="class_range"),
        pytest.param("[-]x", GlobShape(complexity=0, specific=True), id="class_leading_dash"),
        pytest.param("[a-]x", GlobShape(complexity=0, specific=True), id="class_trailing_dash"),
        pytest.param("[]x", GlobShape(complexity=0, specific=True), id="empty_class"),
        pytest.param(r"[\]]x", GlobShape(complexity=0, specific=True), id="class_escape"),
        pytest.param(r"\*", GlobShape(complexity=0, specific=True), id="escaped_wildcard"),
        pytest.param(r"\{\}\[\]", GlobShape(complexity=0, specific=True), id="escaped"),
        pytest.param("a,b", GlobShape(complexity=0, specific=True), id="comma_outside_group"),
    ],
)
def test_parse_glob(pattern: str, expected: GlobShape) -> None:
    assert parse_glob(pattern) == expected


@pytest.mark.parametrize(
    "pattern",
    [
        pytest.param("*", id="wildcard"),
        pytest.param("**", id="wildcards"),
        pytest.param("?*", id="any"),
        pytest.param("*/*", id="slash"),
        pytest.param(r"*\/*", id="escaped_slash"),
        pytest.param("*[abc]*", id="class"),
        pytest.param("{*,/health}", id="group_with_unspecific_alternative"),
        pytest.param("{health,}*", id="group_with_empty_alternative"),
        pytest.param("", id="empty"),
    ],
)
def test_parse_glob_unspecific(pattern: str) -> None:
    assert parse_glob(pattern).specific is False


@pytest.mark.parametrize(
    ("pattern", "message"),
    [
        pytest.param("foo]", "A `]` has no matching `[`", id="unbalanced_close_class"),
        pytest.param("[foo", "A `[` has no matching `]`", id="unbalanced_open_class"),
        pytest.param("[a[b]", "A `[` inside a character class", id="nested_class"),
        pytest.param("[z-a]", "The range `z-a` is invalid", id="invalid_range"),
        pytest.param("[a-c-B]", "The range `a-B` is invalid", id="invalid_extended_range"),
        pytest.param("foo}", "A `}` has no matching `{`", id="unbalanced_close_group"),
        pytest.param("{foo", "A `{` has no matching `}`", id="unbalanced_open_group"),
        pytest.param("{a,{b}}", "A `{` group cannot contain", id="nested_group"),
        pytest.param("foo\\", "ends with a `\\`", id="trailing_escape"),
        pytest.param("[a\\", "ends with a `\\`", id="trailing_escape_in_class"),
    ],
)
def test_parse_glob_rejects_what_relay_cannot_parse(pattern: str, message: str) -> None:
    with pytest.raises(InvalidGlobPattern, match=re.escape(message)):
        parse_glob(pattern)
