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


crumb_types = {}


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


def validate_payload_for_type(payload, type):
    payload = payload or {}
    ty = crumb_types.get(type)
    if ty is None:
        raise InterfaceValidationError("Invalid breadcrumb type (%s)." %
                                       (type,))
    return ty.validate_payload(payload)


def get_api_context_for_type(data, type, is_public=False):
    ty = crumb_types.get(type)
    if ty is None:
        raise InterfaceValidationError("Invalid breadcrumb type (%s)." %
                                       (type,))
    return ty.get_api_context(data, type, is_public=is_public)


class CrumbType(type):

    def __new__(cls, name, bases, d):
        rv = type.__new__(cls, name, bases, d)
        if d.get('type'):
            crumb_types[d['type']] = rv()
        return rv


class Crumb(object):
    __metaclass__ = CrumbType
    type = None

    def validiate_payload(self, payload):
        return payload

    def get_api_context(self, data, is_public=False):
        return data


class MessageCrumb(Crumb):
    type = 'message'

    def validate_payload(self, payload):
        rv = {}
        for key in 'message', 'logger', 'level', 'classifier':
            value = payload.get(key)
            if value is None:
                continue
            rv[key] = trim(value, 1024)
        if 'message' not in rv:
            raise InterfaceValidationError("No message provided for "
                                           "'message' breadcrumb.")
        return rv


class RpcCrumb(Crumb):
    type = 'rpc'

    def validate_payload(self, payload):
        rv = {}
        for key in 'endpoint', 'params', 'classifier':
            value = payload.get(key)
            if value is not None:
                rv[key] = trim(value, 1024)
        if not rv.get('endpoint'):
            raise InterfaceValidationError("No endpoint provided for "
                                           "'rpc' breadcrumb.")
        return rv


class HttpRequestCrumb(Crumb):
    type = 'http_request'

    def validate_payload(self, payload):
        rv = {}
        for key in 'status_code', 'reason', 'method', 'url', 'headers', \
                   'response', 'classifier':
            value = payload.get(key)
            if value is not None:
                rv[key] = trim(value, 1024)
        if not rv.get('url'):
            raise InterfaceValidationError("No url provided for "
                                           "'http_request' breadcrumb.")
        return rv

    def get_api_context(self, data, is_public=False):
        rv = dict(data)
        status_code = data.pop('status_code', None)
        data['statusCode'] = status_code
        return rv


class QueryCrumb(Crumb):
    type = 'query'

    def validate_payload(self, payload):
        rv = {}
        for key in 'query', 'params', 'classifier':
            value = payload.get(key)
            if value is not None:
                rv[key] = trim(value, 1024)
        if 'query' not in rv:
            raise InterfaceValidationError("Query not provided for 'query' "
                                           "breadcrumb.")
        return rv


class UiEventCrumb(Crumb):
    type = 'ui_event'

    def validate_payload(self, payload):
        rv = {}
        for key in 'type', 'target', 'classifier':
            value = payload.get(key)
            if value is not None:
                rv[key] = trim(value, 1024)
        return rv


class NavigationCrumb(Crumb):
    type = 'navigation'

    def validate_payload(self, payload):
        rv = {}
        for key in 'to', 'from':
            value = payload.get(key)
            if value is not None:
                rv[key] = trim(value, 1024)
        if 'to' not in rv:
            raise InterfaceValidationError("Location not provided for 'navigation' "
                                           "breadcrumb.")
        return rv


class ErrorCrumb(Crumb):
    type = 'error'

    def validate_payload(self, payload):
        rv = {}
        for key in 'type', 'message', 'event_id':
            value = payload.get(key)
            if value is not None:
                rv[key] = trim(value, 1024)
        return rv

    def get_api_context(self, data, is_public=False):
        rv = dict(data)
        event_id = data.pop('event_id', None)
        data['eventId'] = event_id
        return rv


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
            ty = crumb.get('type') or 'message'
            ts = parse_new_timestamp(crumb.get('timestamp'))
            if ts is None:
                raise InterfaceValidationError('Unable to determine timestamp for crumb')
            values.append({
                'type': ty,
                # We need to store timestamps here as this will go into
                # the node store which does not support datetime objects.
                'timestamp': to_timestamp(ts),
                'data': validate_payload_for_type(crumb.get('data'), ty),
            })
        return cls(values=values)

    def get_path(self):
        return 'sentry.interfaces.Breadcrumbs'

    def get_alias(self):
        return 'breadcrumbs'

    def get_api_context(self, is_public=False):
        def _convert(x):
            return {
                'type': x['type'],
                'timestamp': to_datetime(x['timestamp']),
                'data': get_api_context_for_type(x['data'], x['type'],
                                                 is_public=is_public),
            }
        return {
            'values': map(_convert, self.values),
        }
