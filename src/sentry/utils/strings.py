from __future__ import annotations

import ast
import base64
import codecs
import re
import string
import zlib
from typing import Any, Callable, overload

from django.utils.encoding import force_str, smart_str

_sprintf_placeholder_re = re.compile(
    r"%(?:\d+\$)?[+-]?(?:[ 0]|\'.{1})?-?\d*(?:\.\d+)?[bcdeEufFgGosxX]"
)

INVALID_ESCAPE = re.compile(
    r"""
(?<!\\)              # no backslash behind
((?:\\\\)*\\)        # odd number of backslashes
(?!x[0-9a-fA-F]{2})  # char escape: \x__
(?!u[0-9a-fA-F]{4})  # char escape: \u____
(?!U[0-9a-fA-F]{8})  # char escape: \U________
(?![0-7]{1,3})       # octal escape: \_, \__, \___
(?![\\'"abfnrtv])    # other escapes: https://docs.python.org/3/reference/lexical_analysis.html#string-and-bytes-literals
""",
    re.VERBOSE,
)


def unescape_string(value: str) -> str:
    """Unescapes a backslash escaped string."""
    value = INVALID_ESCAPE.sub(r"\1\\", value)
    return ast.literal_eval(f'"""{value}"""')


def strip_lone_surrogates(string: str) -> str:
    """Removes lone surrogates."""
    return string.encode("utf-8", "surrogatepass").decode("utf-8", "ignore")


@overload
def truncatechars(value: None, arg: int, ellipsis: str = ...) -> None:
    ...


@overload
def truncatechars(value: str, arg: int, ellipsis: str = ...) -> str:
    ...


def truncatechars(value: str | None, arg: int, ellipsis: str = "...") -> str | None:
    # TODO (alex) could use unicode ellipsis: u'\u2026'
    """
    Truncates a string after a certain number of chars.

    Argument: Number of chars to truncate after.
    """
    if value is None:
        return value
    try:
        length = int(arg)
    except ValueError:  # Invalid literal for int().
        return value  # Fail silently.
    if len(value) > length:
        return value[: max(0, length - len(ellipsis))] + ellipsis
    return value


def compress(value: bytes) -> str:
    """
    Compresses a value for safe passage as a string.

    This returns a unicode string rather than bytes, as the Django ORM works
    with unicode objects.
    """
    return base64.b64encode(zlib.compress(value)).decode("utf-8")


def decompress(value: str) -> bytes:
    return zlib.decompress(base64.b64decode(value))


def strip(value: str | None) -> str:
    if not value:
        return ""
    return smart_str(value).strip()


def soft_hyphenate(value: str, length: int, hyphen: str = "\u00ad") -> str:
    return hyphen.join([value[i : (i + length)] for i in range(0, len(value), length)])


def soft_break(value: str, length: int, process: Callable[[str], str] = lambda chunk: chunk) -> str:
    """
    Encourages soft breaking of text values above a maximum length by adding
    zero-width spaces after common delimiters, as well as soft-hyphenating long
    identifiers.
    """
    delimiters = re.compile(r"([{}]+)".format("".join(map(re.escape, ",.$:/+@!?()<>[]{}"))))

    def soft_break_delimiter(match: re.Match[str]) -> str:
        results = []

        value = match.group(0)
        chunks = delimiters.split(value)
        for i, chunk in enumerate(chunks):
            if i % 2 == 1:  # check if this is this a delimiter
                results.extend([chunk, "\u200b"])
            else:
                results.append(process(chunk))

        return "".join(results).rstrip("\u200b")

    return re.sub(rf"\S{{{length},}}", soft_break_delimiter, value)


def to_unicode(value: Any) -> str:
    try:
        value = str(force_str(value))
    except (UnicodeEncodeError, UnicodeDecodeError):
        value = "(Error decoding value)"
    except Exception:  # in some cases we get a different exception
        try:
            value = str(repr(type(value)))
        except Exception:
            value = "(Error decoding value)"
    return value


valid_dot_atom_characters = frozenset(string.ascii_letters + string.digits + ".!#$%&'*+-/=?^_`{|}~")


def is_valid_dot_atom(value: str) -> bool:
    """Validate an input string as an RFC 2822 dot-atom-text value."""
    return (
        isinstance(value, str)  # must be a string type
        and not value[0] == "."
        and not value[-1] == "."  # cannot start or end with a dot
        and set(value).issubset(valid_dot_atom_characters)
    )  # can only contain valid characters


def count_sprintf_parameters(string: str) -> int:
    """Counts the number of sprintf parameters in a string."""
    return len(_sprintf_placeholder_re.findall(string))


def codec_lookup(encoding: str, default: str = "utf-8") -> codecs.CodecInfo:
    """Safely lookup a codec and ignore non-text codecs,
    falling back to a default on errors.
    Note: the default value is not sanity checked and would
    bypass these checks."""

    def _get_default() -> codecs.CodecInfo:
        return codecs.lookup(default)

    if not encoding:
        return _get_default()

    try:
        info = codecs.lookup(encoding)
    except (LookupError, TypeError):
        return _get_default()

    try:
        # Check for `CodecInfo._is_text_encoding`.
        # If this attribute exists, we can assume we can operate
        # with this encoding value safely. This attribute was
        # introduced into 2.7.12, so versions prior to this will
        # raise, but this is the best we can do.
        if not info._is_text_encoding:
            return _get_default()
    except AttributeError:
        pass

    # `undefined` is special a special encoding in python that 100% of
    # the time will raise, so ignore it.
    if info.name == "undefined":
        return _get_default()

    return info


def oxfordize_list(strings: list[str]) -> str:
    """Given a list of strings, formats them correctly given the length of the
    list. For example:

        oxfordize_list(['A'])  =>  'A'

        oxfordize_list(['A', 'B'])  =>  'A and B'

        oxfordize_list(['A', 'B', 'C'])  =>  'A, B, and C'
    """

    if len(strings) == 0:
        return ""
    elif len(strings) == 1:
        return strings[0]
    elif len(strings) == 2:
        return f"{strings[0]} and {strings[1]}"

    return f"{', '.join(strings[:-1])}, and {strings[-1]}"


def to_single_line_str(original_str: str) -> str:
    return " ".join(original_str.strip().split())
