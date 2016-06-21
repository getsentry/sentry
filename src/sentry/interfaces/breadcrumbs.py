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
    # Common aliases
    if type == 'warn':
        return 'warning'
    elif type == 'fatal':
        return 'critical'
    return 'info'


class Breadcrumbs(Interface):
    """
    This interface stores information that leads up to an error.

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
    display_score = 1100
    score = 800

    @classmethod
    def to_python(cls, data):
        values = []
        for crumb in data.get('values') or ():
            values.append(cls.normalize_crumb(crumb))
        return cls(values=values)

    @classmethod
    def normalize_crumb(cls, crumb):
        ty = crumb.get('type') or 'default'
        ts = parse_new_timestamp(crumb.get('timestamp'))
        if ts is None:
            raise InterfaceValidationError('Unable to determine timestamp '
                                           'for crumb')

        rv = {
            'type': ty,
            'timestamp': to_timestamp(ts),
        }

        level = crumb.get('level')
        if level not in (None, 'info'):
            rv['level'] = level

        msg = crumb.get('message')
        if msg is not None:
            rv['message'] = trim(unicode(msg), 4096)

        category = crumb.get('category')
        if category is not None:
            rv['category'] = trim(unicode(category), 256)

        event_id = crumb.get('event_id')
        if event_id is not None:
            rv['event_id'] = event_id

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
                'level': x.get('level', 'info'),
                'message': x.get('message'),
                'category': x.get('category'),
                'data': x.get('data') or None,
                'event_id': x.get('event_id'),
            }
        return {
            'values': map(_convert, self.values),
        }
