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


def better_decoder(data):
    return data


def dumps(value, **kwargs):
    if 'separators' not in kwargs:
        kwargs['separators'] = (',', ':')
    return json.dumps(value, cls=BetterJSONEncoder, **kwargs)


def loads(value, **kwargs):
    return json.loads(value, object_hook=better_decoder)
