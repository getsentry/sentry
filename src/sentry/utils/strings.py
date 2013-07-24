"""
sentry.utils.strings
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import base64
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
    if not isinstance(value, basestring):
        return smart_unicode(value)  # fuck it
    return smart_unicode(value).strip()
