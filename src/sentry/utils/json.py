"""
sentry.utils.json
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

# Avoid shadowing the standard library json module
from __future__ import absolute_import

from simplejson import JSONEncoder, JSONEncoderForHTML, _default_decoder
import datetime
import uuid
import six
import decimal

from django.utils.timezone import is_aware
from django.utils.html import mark_safe


def better_default_encoder(o):
    if isinstance(o, uuid.UUID):
        return o.hex
    elif isinstance(o, datetime.datetime):
        return o.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    elif isinstance(o, datetime.date):
        return o.isoformat()
    elif isinstance(o, datetime.time):
        if is_aware(o):
            raise ValueError("JSON can't represent timezone-aware times.")
        r = o.isoformat()
        if o.microsecond:
            r = r[:12]
        return r
    elif isinstance(o, (set, frozenset)):
        return list(o)
    elif isinstance(o, decimal.Decimal):
        return six.text_type(o)
    raise TypeError(repr(o) + ' is not JSON serializable')


_default_encoder = JSONEncoder(
    separators=(',', ':'),
    ignore_nan=True,
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    encoding='utf-8',
    default=better_default_encoder,
)

_default_escaped_encoder = JSONEncoderForHTML(
    separators=(',', ':'),
    ignore_nan=True,
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    encoding='utf-8',
    default=better_default_encoder,
)


def dump(value, fp, **kwargs):
    for chunk in _default_encoder.iterencode(value):
        fp.write(chunk)


def dumps(value, escape=False, **kwargs):
    # Legacy use. Do not use. Use dumps_htmlsafe
    if escape:
        return _default_escaped_encoder.encode(value)
    return _default_encoder.encode(value)


def loads(value, **kwargs):
    return _default_decoder.decode(value)


def dumps_htmlsafe(value):
    return mark_safe(_default_escaped_encoder.encode(value))
