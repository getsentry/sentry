"""
sentry.utils.data_scrubber
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import re
import six
from urlparse import urlsplit, urlunsplit

from sentry.constants import DEFAULT_SCRUBBED_FIELDS


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
    MASK = '*' * 8
    VALUES_RE = re.compile(r'\b(?:\d[ -]*?){13,16}\b')

    def __init__(self, fields=None):
        if fields:
            self.fields = DEFAULT_SCRUBBED_FIELDS + tuple(fields)
        else:
            self.fields = DEFAULT_SCRUBBED_FIELDS

    def apply(self, data):
        # TODO(dcramer): move this into each interface
        if 'sentry.interfaces.Stacktrace' in data:
            self.filter_stacktrace(data['sentry.interfaces.Stacktrace'])

        if 'sentry.interfaces.Exception' in data:
            for exc in data['sentry.interfaces.Exception']['values']:
                if exc.get('stacktrace'):
                    self.filter_stacktrace(exc['stacktrace'])

        if 'sentry.interfaces.Http' in data:
            self.filter_http(data['sentry.interfaces.Http'])

        if 'extra' in data:
            data['extra'] = varmap(self.sanitize, data['extra'])

    def sanitize(self, key, value):
        if value is None:
            return

        if isinstance(value, six.string_types):
            if self.VALUES_RE.search(value):
                return self.MASK

            # Check if the value is a url-like object
            # that contains a password
            # e.g. postgres://foo:password@example.com/db
            if '//' in value:
                pieces = urlsplit(value)

                # The following is slightly modified from CPython
                # source to avoid repeating ourselves:
                # https://hg.python.org/cpython/file/2.7/Lib/urlparse.py#l87
                netloc = pieces.netloc
                if '@' in netloc:
                    userinfo, host = netloc.rsplit('@', 1)
                    if ':' in userinfo:
                        netloc = '%s:%s@%s' % (userinfo.split(':', 1)[0], self.MASK, host)
                        # Using urlunsplit here is safe because we're guaranteeing netloc
                        # has a value. If netloc were empty, we could yield incorrect
                        # results.
                        return urlunsplit((pieces[0], netloc) + pieces[2:])

        if isinstance(key, six.string_types):
            key = key.lower()
        else:
            key = ''

        original_value = value
        if isinstance(value, basestring):
            value = value.lower()
        else:
            value = ''

        for field in self.fields:
            if field in key or field in value:
                # store mask as a fixed length for security
                return self.MASK
        return original_value

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
                data[n] = varmap(self.sanitize, data[n])
