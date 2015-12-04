"""
sentry.utils.strings
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import base64
import re
import zlib

from django.utils.encoding import smart_unicode


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
    return base64.b64encode(zlib.compress(value))


def decompress(value):
    return zlib.decompress(base64.b64decode(value))


def gunzip(value):
    return zlib.decompress(value, 16 + zlib.MAX_WBITS)


def strip(value):
    if not value:
        return ''
    return smart_unicode(value).strip()


def soft_hyphenate(value, length, hyphen=u'\u00ad'):
    return hyphen.join([value[i:(i + length)] for i in xrange(0, len(value), length)])


def soft_break(value, length):
    """
    Encourages soft breaking of text values above a maximum length by adding
    zero-width spaces after common delimeters, as well as soft-hyphenating long
    identifiers.
    """
    delimiters = re.compile(r'([{}]+)'.format(''.join(map(re.escape, ',.$:/+@!?()<>[]{}'))))

    def process(match):
        results = []

        value = match.group(0)
        chunks = delimiters.split(value)
        for i, chunk in enumerate(chunks):
            if i % 2 == 1:  # check if this is this a delimiter
                results.extend([chunk, u'\u200b'])
            else:
                # TODO: This could be more intelligent -- this could be a
                # little weird if it soft hyphenated a number, for instance?
                results.append(soft_hyphenate(chunk, length))

        return u''.join(results).rstrip(u'\u200b')

    return re.sub(r'\S{{{},}}'.format(length), process, value)
