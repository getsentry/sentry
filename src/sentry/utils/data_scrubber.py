"""
sentry.utils.data_scrubber
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import re
import six
from six.moves.urllib.parse import urlsplit, urlunsplit

from sentry.constants import DEFAULT_SCRUBBED_FIELDS, FILTER_MASK, NOT_SCRUBBED_VALUES
from sentry.utils.safe import get_path


def varmap(func, var, context=None, name=None):
    """
    Executes ``func(key_name, value)`` on all values
    recurisively discovering dict and list scoped
    values.
    """
    if context is None:
        context = set()

    objid = id(var)
    if objid in context:
        return func(name, '<...>')
    context.add(objid)

    if isinstance(var, dict):
        ret = dict((k, varmap(func, v, context, k)) for k, v in six.iteritems(var))
    elif isinstance(var, (list, tuple)):
        # treat it like a mapping
        if all(isinstance(v, (list, tuple)) and len(v) == 2 for v in var):
            ret = [[k, varmap(func, v, context, k)] for k, v in var]
        else:
            ret = [varmap(func, f, context, name) for f in var]
    else:
        ret = func(name, var)
    context.remove(objid)
    return ret


class SensitiveDataFilter(object):
    """
    Asterisk out things that look like passwords, credit card numbers,
    and API keys in frames, http, and basic extra data.
    """
    VALUES_RE = re.compile(
        r'|'.join(
            [
                # http://www.richardsramblings.com/regex/credit-card-numbers/
                r'\b(?:3[47]\d|(?:4\d|5[1-5]|65)\d{2}|6011)\d{12}\b',
                # various private/public keys
                r'-----BEGIN[A-Z ]+(PRIVATE|PUBLIC) KEY-----.+-----END[A-Z ]+(PRIVATE|PUBLIC) KEY-----',
                # social security numbers (US)
                r'^\b(?!(000|666|9))\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b',
            ]
        ),
        re.DOTALL
    )
    URL_PASSWORD_RE = re.compile(r'\b((?:[a-z0-9]+:)?//[a-zA-Z0-9%_.-]+:)([a-zA-Z0-9%_.-]+)@')

    def __init__(self, fields=None, include_defaults=True, exclude_fields=()):
        if fields:
            fields = tuple(f.lower() for f in filter(None, fields))
        else:
            fields = ()
        if include_defaults:
            fields += DEFAULT_SCRUBBED_FIELDS
        self.exclude_fields = {f.lower() for f in exclude_fields}
        self.fields = set(fields)

    def apply(self, data):
        # TODO(dcramer): move this into each interface
        if data.get('stacktrace'):
            self.filter_stacktrace(data['stacktrace'])

        for exc in get_path(data, 'exception', 'values', filter=True) or ():
            if exc.get('stacktrace'):
                self.filter_stacktrace(exc['stacktrace'])

        for exc in get_path(data, 'threads', 'values', filter=True) or ():
            if exc.get('stacktrace'):
                self.filter_stacktrace(exc['stacktrace'])

        for crumb in get_path(data, 'breadcrumbs', 'values', filter=True) or ():
            self.filter_crumb(crumb)

        if data.get('request'):
            self.filter_http(data['request'])

        if data.get('user'):
            self.filter_user(data['user'])

        if data.get('csp'):
            self.filter_csp(data['csp'])

        if data.get('extra'):
            data['extra'] = varmap(self.sanitize, data['extra'])

        if data.get('contexts'):
            for key, value in six.iteritems(data['contexts']):
                if value:
                    data['contexts'][key] = varmap(self.sanitize, value)

    def sanitize(self, key, value):
        if value is None or value == '':
            return value

        if isinstance(key, six.string_types):
            key = key.lower()
        else:
            key = ''

        if key and key in self.exclude_fields:
            return value

        if isinstance(value, six.string_types):
            if self.VALUES_RE.search(value):
                return FILTER_MASK

            # Check if the value is a url-like object
            # that contains a password
            # e.g. postgres://foo:password@example.com/db
            if '//' in value and '@' in value:
                value = self.URL_PASSWORD_RE.sub(r'\1' + FILTER_MASK + '@', value)

        if isinstance(value, six.string_types):
            str_value = value.lower()
        else:
            str_value = ''

        for field in self.fields:
            if field in str_value:
                return FILTER_MASK
            if field in key and value not in NOT_SCRUBBED_VALUES:
                return FILTER_MASK
        return value

    def filter_stacktrace(self, data):
        if not data.get('frames'):
            return
        for frame in data['frames']:
            if not frame or not frame.get('vars'):
                continue
            frame['vars'] = varmap(self.sanitize, frame['vars'])

    def filter_http(self, data):
        for n in ('data', 'cookies', 'headers', 'env', 'query_string'):
            if not data.get(n):
                continue

            if isinstance(data[n], six.string_types) and '=' in data[n]:
                # at this point we've assumed it's a standard HTTP query
                querybits = []
                for bit in data[n].split('&'):
                    chunk = bit.split('=')
                    if len(chunk) == 2:
                        querybits.append((chunk[0], self.sanitize(*chunk)))
                    else:
                        querybits.append(chunk)

                data[n] = '&'.join('='.join(k) for k in querybits)
            else:
                # Encoded structured data (HTTP bodies, headers) would have
                # already been decoded by the request interface.
                data[n] = varmap(self.sanitize, data[n])

    def filter_user(self, data):
        if not data.get('data'):
            return
        data['data'] = varmap(self.sanitize, data['data'])

    def filter_crumb(self, data):
        for key in 'data', 'message':
            val = data.get(key)
            if val:
                data[key] = varmap(self.sanitize, val)

    def filter_csp(self, data):
        for key in 'blocked_uri', 'document_uri':
            if not data.get(key):
                continue
            value = data[key]
            if not isinstance(value, six.string_types):
                continue
            if '?' not in value:
                continue
            if '=' not in value:
                continue
            scheme, netloc, path, query, fragment = urlsplit(value)
            querybits = []
            for bit in query.split('&'):
                chunk = bit.split('=')
                if len(chunk) == 2:
                    querybits.append((chunk[0], self.sanitize(*chunk)))
                else:
                    querybits.append(chunk)
            query = '&'.join('='.join(k) for k in querybits)
            data[key] = urlunsplit((scheme, netloc, path, query, fragment))
