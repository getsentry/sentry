"""
sentry.utils.strings
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import base64
import re
import six
import string
import zlib

from django.utils.encoding import force_text, smart_text
from itertools import count

# Callsigns we do not want to generate automatically because they might
# overlap with something else that is popular (like GH for GitHub)
CALLSIGN_BLACKLIST = ['GH']

_callsign_re = re.compile(r'^[A-Z]{2,6}$')
_word_sep_re = re.compile(r'[\s.;,_-]+(?u)')
_camelcase_re = re.compile(
    r'(?:[A-Z]{2,}(?=[A-Z]))|(?:[A-Z][a-z0-9]+)|(?:[a-z0-9]+)')
_letters_re = re.compile(r'[A-Z]+')
_digit_re = re.compile(r'\d+')
_sprintf_placeholder_re = re.compile(
    r'%(?:\d+\$)?[+-]?(?:[ 0]|\'.{1})?-?\d*(?:\.\d+)?[bcdeEufFgGosxX]')


def truncatechars(value, arg):
    """
    Truncates a string after a certain number of chars.

    Argument: Number of chars to truncate after.
    """
    try:
        length = int(arg)
    except ValueError:  # Invalid literal for int().
        return value  # Fail silently.
    if len(value) > length:
        return value[:length - 3] + '...'
    return value


def compress(value):
    """
    Compresses a value for safe passage as a string.

    This returns a unicode string rather than bytes, as the Django ORM works
    with unicode objects.
    """
    return base64.b64encode(zlib.compress(value)).decode('utf-8')


def decompress(value):
    return zlib.decompress(base64.b64decode(value))


def gunzip(value):
    return zlib.decompress(value, 16 + zlib.MAX_WBITS)


def strip(value):
    if not value:
        return ''
    return smart_text(value).strip()


def soft_hyphenate(value, length, hyphen=u'\u00ad'):
    return hyphen.join([value[i:(i + length)] for i in range(0, len(value), length)])


def soft_break(value, length, process=lambda chunk: chunk):
    """
    Encourages soft breaking of text values above a maximum length by adding
    zero-width spaces after common delimeters, as well as soft-hyphenating long
    identifiers.
    """
    delimiters = re.compile(r'([{}]+)'.format(''.join(map(re.escape, ',.$:/+@!?()<>[]{}'))))

    def soft_break_delimiter(match):
        results = []

        value = match.group(0)
        chunks = delimiters.split(value)
        for i, chunk in enumerate(chunks):
            if i % 2 == 1:  # check if this is this a delimiter
                results.extend([chunk, u'\u200b'])
            else:
                results.append(process(chunk))

        return u''.join(results).rstrip(u'\u200b')

    return re.sub(r'\S{{{},}}'.format(length), soft_break_delimiter, value)


def to_unicode(value):
    try:
        value = six.text_type(force_text(value))
    except (UnicodeEncodeError, UnicodeDecodeError):
        value = '(Error decoding value)'
    except Exception:  # in some cases we get a different exception
        try:
            value = six.text_type(repr(type(value)))
        except Exception:
            value = '(Error decoding value)'
    return value


def validate_callsign(value):
    if not value:
        return None
    callsign = value.strip().upper()
    if _callsign_re.match(callsign) is None:
        return None
    return callsign


def iter_callsign_choices(project_name):
    words = list(x.upper() for x in tokens_from_name(
        project_name, remove_digits=True))
    bits = []

    if len(words) == 2:
        bits.append(words[0][:1] + words[1][:1])
    elif len(words) == 3:
        bits.append(words[0][:1] + words[1][:1] + words[2][:1])
    elif words:
        bit = words[0][:2]
        if len(bit) == 2:
            bits.append(bit)
        bit = words[0][:3]
        if len(bit) == 3:
            bits.append(bit)

    # Fallback if nothing else works, use PR for project
    if not bits:
        bits.append('PR')

    for bit in bits:
        if bit not in CALLSIGN_BLACKLIST:
            yield bit

    for idx in count(2):
        for bit in bits:
            bit = '%s%d' % (bit, idx)
            if bit not in CALLSIGN_BLACKLIST:
                yield bit


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
            word = _digit_re.sub('', word)
        word = word.lower()
        if word:
            yield word


valid_dot_atom_characters = frozenset(
    string.ascii_letters +
    string.digits +
    ".!#$%&'*+-/=?^_`{|}~"
)


def is_valid_dot_atom(value):
    """Validate an input string as an RFC 2822 dot-atom-text value."""
    return (isinstance(value, six.string_types)  # must be a string type
        and not value[0] == '.'
        and not value[-1] == '.'  # cannot start or end with a dot
        and set(value).issubset(valid_dot_atom_characters))  # can only contain valid characters


def count_sprintf_parameters(string):
    """Counts the number of sprintf parameters in a string."""
    return len(_sprintf_placeholder_re.findall(string))
