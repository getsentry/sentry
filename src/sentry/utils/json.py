"""
sentry.utils.json
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

# Avoid shadowing the standard library json module
from __future__ import absolute_import

from django.core.serializers.json import DjangoJSONEncoder
import json

import datetime
import uuid


class BetterJSONEncoder(DjangoJSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return obj.hex
        elif isinstance(obj, datetime.datetime):
            return obj.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        elif isinstance(obj, (set, frozenset)):
            return list(obj)
        return super(BetterJSONEncoder, self).default(obj)


def dumps(value, escape=False, **kwargs):
    if 'separators' not in kwargs:
        kwargs['separators'] = (',', ':')
    rv = json.dumps(value, cls=BetterJSONEncoder, **kwargs)
    if escape:
        rv = rv.replace('</', '<\/')
    return rv


def loads(value, **kwargs):
    return json.loads(value)
