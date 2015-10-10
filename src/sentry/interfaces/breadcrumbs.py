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


validators = {}


def parse_new_timestamp(value):
    if isinstance(value, datetime):
        return value
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


def typevalidator(ty):
    def decorator(f):
        validators[ty] = f
        return f
    return decorator


def validate_payload_for_type(payload, type):
    payload = payload or {}
    func = validators.get(type)
    if func is None:
        raise InterfaceValidationError("Invalid breadcrumb type (%s)." %
                                       (type,))
    return func(payload)


@typevalidator('message')
def validate_message(payload):
    rv = {}
    for key in 'message', 'logger', 'level':
        value = payload.get(key)
        if value is None:
            continue
        rv[key] = trim(value, 1024)
    if 'message' not in rv:
        raise InterfaceValidationError("No message provided for "
                                       "'message' breadcrumb.")
    return rv


@typevalidator('rpc')
def validate_rpc(payload):
    rv = {}
    for key in 'endpoint', 'params', 'classifier':
        value = payload.get(key)
        if value is not None:
            rv[key] = trim(value, 1024)
    if not rv.get('endpoint'):
        raise InterfaceValidationError("No message provided for "
                                       "'message' breadcrumb.")
    return rv


@typevalidator('http_request')
def validate_http_request(payload):
    rv = {}
    for key in 'statusCode', 'reason', 'method', 'url', 'headers', \
               'response', 'classifier':
        value = payload.get(key)
        if value is not None:
            rv[key] = trim(value, 1024)
    if not rv.get('url'):
        raise InterfaceValidationError("No message provided for "
                                       "'url' breadcrumb.")
    return rv


@typevalidator('query')
def validate_query(payload):
    rv = {}
    for key in 'query', 'params', 'classifier':
        value = payload.get(key)
        if value is not None:
            rv[key] = trim(value, 1024)
    if 'query' not in rv:
        raise InterfaceValidationError("Query not provided for 'query' "
                                       "breadcrumb.")
    return rv


class Breadcrumbs(Interface):
    """
    This interface stores informationt that leads up to an error in the
    database.

    - ``message`` must be no more than 1000 characters in length.

    >>> {
    >>>     "message": "My raw message with interpreted strings like %s",
    >>>     "params": ["this"]
    >>> }
    """
    display_score = 5000
    score = 100

    @classmethod
    def to_python(cls, data):
        items = []
        for crumb in data.get('items') or ():
            ty = crumb.get('type') or 'message'
            ts = parse_new_timestamp(crumb.get('timestamp'))
            if ts is None:
                continue
            items.append({
                'type': ty,
                'timestamp': ts,
                'data': validate_payload_for_type(crumb.get('data'), ty),
            })
        return cls(items=items)

    def get_path(self):
        return 'sentry.interfaces.Breadcrumbs'

    def get_alias(self):
        return 'breadcrumbs'

    def get_api_context(self, is_public=False):
        return {
            'items': self.items,
        }
