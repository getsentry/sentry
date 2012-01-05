"""
sentry.utils.json
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.core.serializers.json import DjangoJSONEncoder
from django.utils import simplejson

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
    return simplejson.dumps(value, cls=BetterJSONEncoder, **kwargs)


def loads(value, **kwargs):
    return simplejson.loads(value, object_hook=better_decoder)
