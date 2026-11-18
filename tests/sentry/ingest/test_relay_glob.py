import re

import pytest

from sentry.ingest.relay_glob import InvalidGlobPattern, glob_complexity


@pytest.mark.parametrize(
    ("pattern", "expected"),
    [
        pytest.param("/health", 0, id="literal"),
        pytest.param("*/health*", 0, id="wildcards"),
        pytest.param("*/health{/,}", 2, id="default_list"),
        pytest.param("{a,b}/{c,d,e}", 6, id="product"),
        pytest.param("{}foo", 1, id="empty_group"),
        pytest.param("*[a-z]*", 0, id="class"),
        pytest.param("[!a-c-e]x", 0, id="class_range"),
        pytest.param("[-]x", 0, id="class_leading_dash"),
        pytest.param("[a-]x", 0, id="class_trailing_dash"),
        pytest.param("[]x", 0, id="empty_class"),
        pytest.param(r"[\]]x", 0, id="class_escape"),
        pytest.param("[{,}]", 0, id="group_characters_in_class"),
        pytest.param(r"\*", 0, id="escaped_wildcard"),
        pytest.param(r"\{\}\[\]", 0, id="escaped"),
        pytest.param(r"{a\,b}", 1, id="escaped_comma_in_group"),
        pytest.param("a,b", 0, id="comma_outside_group"),
        pytest.param("", 0, id="empty"),
    ],
)
def test_glob_complexity(pattern: str, expected: int) -> None:
    assert glob_complexity(pattern) == expected


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
def test_glob_complexity_rejects_what_relay_cannot_parse(pattern: str, message: str) -> None:
    with pytest.raises(InvalidGlobPattern, match=re.escape(message)):
        glob_complexity(pattern)
