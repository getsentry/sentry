"""
sentry.utils.json
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

# Avoid shadowing the standard library json module
from __future__ import absolute_import

import simplejson
import datetime
import uuid
import decimal

from django.utils.timezone import is_aware


class BetterJSONEncoder(simplejson.JSONEncoder):
    def default(self, o):
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
            return str(o)
        return super(BetterJSONEncoder, self).default(o)


def dumps(value, escape=False, **kwargs):
    kwargs.setdefault('separators', (',', ':'))
    kwargs.setdefault('ignore_nan', True)
    rv = simplejson.dumps(value, cls=BetterJSONEncoder, **kwargs)
    if escape:
        rv = rv.replace('</', '<\/')
    return rv


def loads(value, **kwargs):
    return simplejson.loads(value)
