"""
sentry.interfaces.breadcrumbs
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Breadcrumbs',)

import pytz
from datetime import datetime

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.utils.safe import trim
from sentry.utils.dates import to_timestamp, to_datetime


validators = {}


def parse_new_timestamp(value):
    # TODO(mitsuhiko): merge this code with coreapis date parser
    if isinstance(value, datetime):
        return value
    elif isinstance(value, (int, long, float)):
        return datetime.utcfromtimestamp(value).replace(tzinfo=pytz.utc)
    value = (value or '').rstrip('Z').encode('ascii', 'replace').split('.', 1)
    if not value:
        return None
    try:
        rv = datetime.strptime(value[0], '%Y-%m-%dT%H:%M:%S')
    except Exception:
        return None
    if len(value) == 2:
        try:
            rv = rv.replace(microsecond=int(value[1]
                            .ljust(6, '0')[:6]))
        except ValueError:
            rv = None
    return rv.replace(tzinfo=pytz.utc)


def _get_implied_category(category, type):
    if category is not None:
        return category
    if type in ('critical', 'error', 'warning', 'info', 'debug'):
        return type
    return 'info'


class Breadcrumbs(Interface):
    """
    This interface stores informationt that leads up to an error in the
    database.

    - ``message`` must be no more than 1000 characters in length.

    >>> [{
    >>>     "type": "message",
    >>>     // timestamp can be ISO format or a unix timestamp (as float)
    >>>     "timestamp": "2016-01-17T12:30:00",
    >>>     "data": {
    >>>         "message": "My raw message with interpreted strings like %s",
    >>>     }
    >>> ], ...}
    """
    display_score = 5000
    score = 100

    @classmethod
    def to_python(cls, data):
        values = []
        for crumb in data.get('values') or ():
            values.append(cls.normalize_crumb(crumb))
        return cls(values=values)

    @classmethod
    def normalize_crumb(cls, crumb):
        ty = crumb.get('type') or 'info'
        ts = parse_new_timestamp(crumb.get('timestamp'))
        if ts is None:
            raise InterfaceValidationError('Unable to determine timestamp '
                                           'for crumb')

        rv = {
            'type': ty,
            'timestamp': to_timestamp(ts),
        }

        msg = crumb.get('message')
        if msg is not None:
            rv['message'] = trim(unicode(msg), 4096)
            msg_args = crumb.get('message_args')
            if msg_args:
                rv['message_args'] = trim(list(msg_args), 2048)

        for key in 'category', 'classifier':
            val = crumb.get(key)
            if val is not None:
                rv[key] = trim(unicode(val), 256)

        duration = crumb.get('duration')
        if duration is not None:
            rv['duration'] = float(duration)

        if 'data' in crumb:
            rv['data'] = trim(crumb['data'], 4096)

        return rv

    def get_path(self):
        return 'sentry.interfaces.Breadcrumbs'

    def get_alias(self):
        return 'breadcrumbs'

    def get_api_context(self, is_public=False):
        def _convert(x):
            return {
                'type': x['type'],
                'timestamp': to_datetime(x['timestamp']),
                'duration': x.get('duration'),
                'message': x.get('message'),
                'message_args': x.get('message_args'),
                'category': _get_implied_category(x.get('category'), x['type']),
                'classifier': x.get('classifier'),
                'duration': x.get('duration'),
                'data': x.get('data') or {},
            }
        return {
            'values': map(_convert, self.values),
        }
