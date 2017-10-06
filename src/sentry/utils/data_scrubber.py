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
        if 'sentry.interfaces.Stacktrace' in data:
            self.filter_stacktrace(data['sentry.interfaces.Stacktrace'])

        if 'sentry.interfaces.Exception' in data:
            for exc in data['sentry.interfaces.Exception']['values']:
                if exc.get('stacktrace'):
                    self.filter_stacktrace(exc['stacktrace'])

        if 'sentry.interfaces.Breadcrumbs' in data:
            for crumb in data['sentry.interfaces.Breadcrumbs'].get('values') or ():
                self.filter_crumb(crumb)

        if 'sentry.interfaces.Http' in data:
            self.filter_http(data['sentry.interfaces.Http'])

        if 'sentry.interfaces.User' in data:
            self.filter_user(data['sentry.interfaces.User'])

        if 'sentry.interfaces.Csp' in data:
            self.filter_csp(data['sentry.interfaces.Csp'])

        if 'extra' in data:
            data['extra'] = varmap(self.sanitize, data['extra'])

        if 'contexts' in data:
            for key, value in six.iteritems(data['contexts']):
                data['contexts'][key] = varmap(self.sanitize, value)

    def sanitize(self, key, value):
        if value is None:
            return

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
        if 'frames' not in data:
            return
        for frame in data['frames']:
            if 'vars' not in frame:
                continue
            frame['vars'] = varmap(self.sanitize, frame['vars'])

    def filter_http(self, data):
        for n in ('data', 'cookies', 'headers', 'env', 'query_string'):
            if n not in data:
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
        if 'data' not in data:
            return
        data['data'] = varmap(self.sanitize, data['data'])

    def filter_crumb(self, data):
        for key in 'data', 'message':
            val = data.get(key)
            if val:
                data[key] = varmap(self.sanitize, val)

    def filter_csp(self, data):
        for key in 'blocked_uri', 'document_uri':
            if key not in data:
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
