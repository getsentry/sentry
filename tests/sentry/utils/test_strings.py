from __future__ import absolute_import

import sys
import functools

from sentry.utils.strings import (
    is_valid_dot_atom,
    soft_break,
    soft_hyphenate,
    tokens_from_name,
    codec_lookup,
    truncatechars,
    oxfordize_list,
)

ZWSP = u"\u200b"  # zero width space
SHY = u"\u00ad"  # soft hyphen


def test_codec_lookup():
    def assert_match(enc, ref=None):
        if ref is None:
            ref = enc
        rv = codec_lookup(enc)
        if rv is None:
            assert ref is rv is None
        else:
            assert rv.name == ref

    assert codec_lookup("utf-8").name == "utf-8"
    assert codec_lookup("utf8").name == "utf-8"
    if sys.version_info[:3] >= (2, 7, 12):
        assert codec_lookup("zlib").name == "utf-8"
    assert codec_lookup("utf16").name == "utf-16"
    assert codec_lookup("undefined").name == "utf-8"
    assert codec_lookup("undefined", default=None) is None
    assert codec_lookup("undefined", default="latin1").name == "iso8859-1"
    if sys.version_info[:3] >= (2, 7, 12):
        assert codec_lookup("zlib", default="latin1").name == "iso8859-1"
    assert codec_lookup("unknownshit", default="latin1").name == "iso8859-1"


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


def test_tokens_from_name():
    assert list(tokens_from_name("MyHTTPProject42")) == ["my", "http", "project42"]
    assert list(tokens_from_name("MyHTTPProject42", remove_digits=True)) == [
        "my",
        "http",
        "project",
    ]
    assert list(tokens_from_name("MyHTTPProject Awesome 42 Stuff")) == [
        "my",
        "http",
        "project",
        "awesome",
        "42",
        "stuff",
    ]
    assert list(tokens_from_name("MyHTTPProject Awesome 42 Stuff", remove_digits=True)) == [
        "my",
        "http",
        "project",
        "awesome",
        "stuff",
    ]


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

    assert truncatechars("12345", 6, ellipsis=u"\u2026") == u"12345"
    assert truncatechars("12345", 5, ellipsis=u"\u2026") == u"12345"
    assert truncatechars("12345", 4, ellipsis=u"\u2026") == u"123\u2026"
    assert truncatechars("12345", 3, ellipsis=u"\u2026") == u"12\u2026"
    assert truncatechars("12345", 2, ellipsis=u"\u2026") == u"1\u2026"
    assert truncatechars("12345", 1, ellipsis=u"\u2026") == u"\u2026"
    assert truncatechars("12345", 0, ellipsis=u"\u2026") == u"\u2026"

    assert truncatechars(None, 1) is None


def test_oxfordize_list():
    assert oxfordize_list([]) == ""
    assert oxfordize_list(["A"]) == "A"
    assert oxfordize_list(["A", "B"]) == "A and B"
    assert oxfordize_list(["A", "B", "C"]) == "A, B, and C"
    assert oxfordize_list(["A", "B", "C", "D"]) == "A, B, C, and D"
