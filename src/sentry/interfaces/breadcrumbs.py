"""
sentry.interfaces.breadcrumbs
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Breadcrumbs', )

import six

from sentry.interfaces.base import Interface, InterfaceValidationError, prune_empty_keys
from sentry.utils import json
from sentry.utils.safe import get_path, trim
from sentry.utils.dates import to_timestamp, to_datetime, parse_timestamp


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
        for index, crumb in enumerate(get_path(data, 'values', filter=True, default=())):
            # TODO(ja): Handle already invalid and None breadcrumbs

            try:
                values.append(cls.normalize_crumb(crumb))
            except InterfaceValidationError:
                # TODO(dcramer): we dont want to discard the entirety of data
                # when one breadcrumb errors, but it'd be nice if we could still
                # record an error
                pass

        return cls(values=values)

    def to_json(self):
        return prune_empty_keys({
            'values': [
                prune_empty_keys({
                    'type': crumb['type'],
                    'level': crumb['level'],
                    'timestamp': crumb['timestamp'],
                    'message': crumb['message'],
                    'category': crumb['category'],
                    'event_id': crumb['event_id'],
                    'data': crumb['data'] or None
                }) for crumb in self.values
            ] or None
        })

    @classmethod
    def normalize_crumb(cls, crumb):
        ty = crumb.get('type') or 'default'
        level = crumb.get('level') or 'info'
        ts = parse_timestamp(crumb.get('timestamp'))
        if ts is None:
            raise InterfaceValidationError('Unable to determine timestamp for crumb')
        ts = to_timestamp(ts)

        msg = crumb.get('message')
        if msg is not None:
            msg = trim(six.text_type(msg), 4096)

        category = crumb.get('category')
        if category is not None:
            category = trim(six.text_type(category), 256)

        event_id = crumb.get('event_id')

        data = crumb.get('data')
        if data:
            try:
                for key, value in six.iteritems(data):
                    if not isinstance(value, six.string_types):
                        data[key] = json.dumps(value)
            except AttributeError:
                # TODO(dcramer): we dont want to discard the the rest of the
                # crumb, but it'd be nice if we could record an error
                # raise InterfaceValidationError(
                #     'The ``data`` on breadcrumbs must be a mapping (received {})'.format(
                #         type(crumb['data']),
                #     )
                # )
                data = None
            else:
                data = trim(data, 4096)

        return {
            'type': ty,
            'level': level,
            'timestamp': ts,
            'message': msg,
            'category': category,
            'event_id': event_id,
            'data': data
        }

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
            'values': [_convert(v) for v in self.values],
        }

    def get_api_meta(self, meta, is_public=False):
        if meta and 'values' not in meta:
            return {'values': meta}
        else:
            return meta
