import functools

from sentry.utils.strings import (
    codec_lookup,
    is_valid_dot_atom,
    oxfordize_list,
    soft_break,
    soft_hyphenate,
    tokens_from_name,
    truncatechars,
    unescape_string,
)

ZWSP = "\u200b"  # zero width space
SHY = "\u00ad"  # soft hyphen


def test_unescape_string():
    # For raw string literals, python escapes any backslash,
    # regardless if it's part of a recognized escape sequence or not.
    value = r"\x80"
    assert r"\x80" == "\\x80"

    # We want to unescape that.
    assert unescape_string(value) == "\x80"
    assert r"\x80" != "\x80"

    # For string literals, python leaves recognized escape sequences alone,
    # and we should as well.
    assert unescape_string("\x80") == "\x80"

    # Essentially, we want the resulting str to
    # have the same number of backslashes as the raw string.
    assert unescape_string(r"\\x80") == "\\x80"
    assert unescape_string(r"\\\x80") == "\\\x80"
    assert unescape_string(r"\\\\x80") == "\\\\x80"

    # Now for a real world example.
    # If we specify this value as a string literal, we'll get a DeprecationWarning
    # because \* is not a recognized escape sequence.
    # This raw string literal reflects what was read off disk from our grouping
    # enhancement config text files, before they were corrected to be \\**.
    value = r"C:/WINDOWS/system32/DriverStore\**"
    assert value == "C:/WINDOWS/system32/DriverStore\\**"

    # This string should remain unchanged after unescape_string,
    # because there are no recognized escape sequences to unescape.
    # From 3.6 to 3.8 a DeprecationWarning which we suppress will
    # be emitted during .decode("unicode-escape", "unicode-escape-recovery"),
    # because \* isn't a recognized escape sequence.
    # We just want this to be a reminder if the warning is upgraded to a
    # behavior change in 3.9+.
    assert unescape_string(value) == "C:/WINDOWS/system32/DriverStore\\**"


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
    assert codec_lookup("zlib").name == "utf-8"
    assert codec_lookup("utf16").name == "utf-16"
    assert codec_lookup("undefined").name == "utf-8"
    assert codec_lookup("undefined", default=None) is None
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
