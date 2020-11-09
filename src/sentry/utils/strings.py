from __future__ import absolute_import

import base64
import codecs
import re
import six
import string
import zlib

from django.utils.encoding import force_text, smart_text
from sentry.utils.compat import map

_word_sep_re = re.compile(r"[\s.;,_-]+", re.UNICODE)
_camelcase_re = re.compile(r"(?:[A-Z]{2,}(?=[A-Z]))|(?:[A-Z][a-z0-9]+)|(?:[a-z0-9]+)")
_letters_re = re.compile(r"[A-Z]+")
_digit_re = re.compile(r"\d+")
_sprintf_placeholder_re = re.compile(
    r"%(?:\d+\$)?[+-]?(?:[ 0]|\'.{1})?-?\d*(?:\.\d+)?[bcdeEufFgGosxX]"
)

_lone_surrogate = re.compile(
    u"""(?x)
    (
        [\ud800-\udbff](?![\udc00-\udfff])
    ) | (
        (?<![\ud800-\udbff])
        [\udc00-\udfff]
    )
"""
)


def unicode_escape_recovery_handler(err):
    try:
        value = err.object[err.start : err.end].decode("utf-8")
    except UnicodeError:
        value = u""
    return value, err.end


codecs.register_error("unicode-escape-recovery", unicode_escape_recovery_handler)


def unescape_string(value):
    """Unescapes a backslash escaped string."""
    return value.encode("ascii", "backslashreplace").decode(
        "unicode-escape", "unicode-escape-recovery"
    )


def strip_lone_surrogates(string):
    """Removes lone surrogates."""
    if six.PY3:
        return string.encode("utf-8", "surrogatepass").decode("utf-8", "ignore")
    return _lone_surrogate.sub("", string)


def truncatechars(value, arg, ellipsis="..."):
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


def compress(value):
    """
    Compresses a value for safe passage as a string.

    This returns a unicode string rather than bytes, as the Django ORM works
    with unicode objects.
    """
    return base64.b64encode(zlib.compress(value)).decode("utf-8")


def decompress(value):
    return zlib.decompress(base64.b64decode(value))


def gunzip(value):
    return zlib.decompress(value, 16 + zlib.MAX_WBITS)


def strip(value):
    if not value:
        return ""
    return smart_text(value).strip()


def soft_hyphenate(value, length, hyphen=u"\u00ad"):
    return hyphen.join([value[i : (i + length)] for i in range(0, len(value), length)])


def soft_break(value, length, process=lambda chunk: chunk):
    """
    Encourages soft breaking of text values above a maximum length by adding
    zero-width spaces after common delimeters, as well as soft-hyphenating long
    identifiers.
    """
    delimiters = re.compile(
        six.text_type(r"([{}]+)").format("".join(map(re.escape, ",.$:/+@!?()<>[]{}")))
    )

    def soft_break_delimiter(match):
        results = []

        value = match.group(0)
        chunks = delimiters.split(value)
        for i, chunk in enumerate(chunks):
            if i % 2 == 1:  # check if this is this a delimiter
                results.extend([chunk, u"\u200b"])
            else:
                results.append(process(chunk))

        return u"".join(results).rstrip(u"\u200b")

    return re.sub(six.text_type(r"\S{{{},}}").format(length), soft_break_delimiter, value)


def to_unicode(value):
    try:
        value = six.text_type(force_text(value))
    except (UnicodeEncodeError, UnicodeDecodeError):
        value = "(Error decoding value)"
    except Exception:  # in some cases we get a different exception
        try:
            value = six.text_type(repr(type(value)))
        except Exception:
            value = "(Error decoding value)"
    return value


def split_camelcase(word):
    pieces = _camelcase_re.findall(word)

    # Unicode characters or some stuff, ignore it.
    if sum(len(x) for x in pieces) != len(word):
        yield word
    else:
        for piece in pieces:
            yield piece


def split_any_wordlike(value, handle_camelcase=False):
    for word in _word_sep_re.split(value):
        if handle_camelcase:
            for chunk in split_camelcase(word):
                yield chunk
        else:
            yield word


def tokens_from_name(value, remove_digits=False):
    for word in split_any_wordlike(value, handle_camelcase=True):
        if remove_digits:
            word = _digit_re.sub("", word)
        word = word.lower()
        if word:
            yield word


valid_dot_atom_characters = frozenset(string.ascii_letters + string.digits + ".!#$%&'*+-/=?^_`{|}~")


def is_valid_dot_atom(value):
    """Validate an input string as an RFC 2822 dot-atom-text value."""
    return (
        isinstance(value, six.string_types)  # must be a string type
        and not value[0] == "."
        and not value[-1] == "."  # cannot start or end with a dot
        and set(value).issubset(valid_dot_atom_characters)
    )  # can only contain valid characters


def count_sprintf_parameters(string):
    """Counts the number of sprintf parameters in a string."""
    return len(_sprintf_placeholder_re.findall(string))


def codec_lookup(encoding, default="utf-8"):
    """Safely lookup a codec and ignore non-text codecs,
    falling back to a default on errors.
    Note: the default value is not sanity checked and would
    bypass these checks."""

    def _get_default():
        if default is not None:
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


def oxfordize_list(strings):
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
        return "%s and %s" % (strings[0], strings[1])
    else:
        return "%s, and %s" % (", ".join(strings[:-1]), strings[-1])


def to_single_line_str(original_str):
    return u" ".join(original_str.strip().split())
