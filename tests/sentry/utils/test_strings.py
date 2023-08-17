import functools

import pytest

from sentry.utils.strings import (
    codec_lookup,
    is_valid_dot_atom,
    oxfordize_list,
    soft_break,
    soft_hyphenate,
    truncatechars,
    unescape_string,
)

ZWSP = "\u200b"  # zero width space
SHY = "\u00ad"  # soft hyphen


@pytest.mark.parametrize(
    ("s", "expected"),
    (
        # the literal \x escape sequence is converted to the character
        (r"\x80", "\x80"),
        # the result should have the same number of backslashes as the raw string
        (r"\\x80", "\\x80"),
        (r"\\\x80", "\\\x80"),
        (r"\\\\x80", "\\\\x80"),
        # this string has an invalid escape sequence: \*
        (r"C:/WINDOWS/system32/DriverStore\**", "C:/WINDOWS/system32/DriverStore\\**"),
        # this string has an unterminated invalid escape sequence: \x
        (r"\x", "\\x"),
        (r"\\\x", "\\\\x"),
        # decodes character escapes
        (r"\t", "\t"),
        (r"\0", "\0"),
        (r"\11", "\11"),
        (r"\111", "\111"),
        (r"\u2603", "☃"),
        (r"\U0001f643", "🙃"),
        # probably a mistake in the configuration but it allows quoted strings
        # with embedded newlines
        ("hello\nworld", "hello\nworld"),
    ),
)
def test_unescape_string(s, expected):
    assert unescape_string(s) == expected


def test_codec_lookup():
    assert codec_lookup("utf-8").name == "utf-8"
    assert codec_lookup("utf8").name == "utf-8"
    assert codec_lookup("zlib").name == "utf-8"
    assert codec_lookup("utf16").name == "utf-16"
    assert codec_lookup("undefined").name == "utf-8"
    assert codec_lookup("undefined", default="latin1").name == "iso8859-1"
    assert codec_lookup("zlib", default="latin1").name == "iso8859-1"
    assert codec_lookup("unknowable", default="latin1").name == "iso8859-1"


def test_soft_break():
    assert soft_break(
        "com.example.package.method(argument).anotherMethod(argument)", 15
    ) == ZWSP.join(
        ["com.", "example.", "package.", "method(", "argument).", "anotherMethod(", "argument)"]
    )


def test_soft_break_and_hyphenate():
    hyphenate = functools.partial(soft_hyphenate, length=6)
    assert soft_break("com.reallyreallyreally.long.path", 6, hyphenate) == ZWSP.join(
        ["com.", SHY.join(["really"] * 3) + ".", "long.", "path"]
    )


def test_is_valid_dot_atom():
    assert is_valid_dot_atom("foo")
    assert is_valid_dot_atom("foo.bar")
    assert not is_valid_dot_atom(".foo.bar")
    assert not is_valid_dot_atom("foo.bar.")
    assert not is_valid_dot_atom("foo.\x00")


def test_truncatechars():
    assert truncatechars("12345", 6) == "12345"
    assert truncatechars("12345", 5) == "12345"
    assert truncatechars("12345", 4) == "1..."
    assert truncatechars("12345", 3) == "..."
    assert truncatechars("12345", 2) == "..."
    assert truncatechars("12345", 1) == "..."
    assert truncatechars("12345", 0) == "..."

    assert truncatechars("12345", 6, ellipsis="\u2026") == "12345"
    assert truncatechars("12345", 5, ellipsis="\u2026") == "12345"
    assert truncatechars("12345", 4, ellipsis="\u2026") == "123\u2026"
    assert truncatechars("12345", 3, ellipsis="\u2026") == "12\u2026"
    assert truncatechars("12345", 2, ellipsis="\u2026") == "1\u2026"
    assert truncatechars("12345", 1, ellipsis="\u2026") == "\u2026"
    assert truncatechars("12345", 0, ellipsis="\u2026") == "\u2026"

    assert truncatechars(None, 1) is None


def test_oxfordize_list():
    assert oxfordize_list([]) == ""
    assert oxfordize_list(["A"]) == "A"
    assert oxfordize_list(["A", "B"]) == "A and B"
    assert oxfordize_list(["A", "B", "C"]) == "A, B, and C"
    assert oxfordize_list(["A", "B", "C", "D"]) == "A, B, C, and D"
