"""
sentry.interfaces.http
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Http',)

import re
from django.conf import settings
from django.utils.translation import ugettext as _
from urllib import urlencode
from urlparse import parse_qsl, urlsplit, urlunsplit

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.utils import json
from sentry.utils.safe import trim, trim_dict, trim_pairs
from sentry.web.helpers import render_to_string

# Instead of relying on a list of hardcoded methods, just loosly match
# against a pattern.
http_method_re = re.compile(r'^[A-Z\-_]{3,32}$')


def to_bytes(value):
    if isinstance(value, unicode):
        return value.encode('utf-8')
    return str(value)


def format_headers(value):
    if not value:
        return ()

    if isinstance(value, dict):
        value = value.items()

    result = []
    cookie_header = None
    for k, v in value:
        # If a header value is a list of header,
        # we want to normalize this into a comma separated list
        # This is how most other libraries handle this.
        # See: urllib3._collections:HTTPHeaderDict.itermerged
        if isinstance(v, list):
            v = ', '.join(v)

        if k.lower() == 'cookie':
            cookie_header = v
        else:
            if not isinstance(v, basestring):
                v = unicode(v)
            result.append((k.title(), v))
    return result, cookie_header


def format_cookies(value):
    if not value:
        return ()

    if isinstance(value, basestring):
        value = parse_qsl(value, keep_blank_values=True)

    if isinstance(value, dict):
        value = value.items()

    return [
        map(fix_broken_encoding, (k.strip(), v))
        for k, v in value
    ]


def fix_broken_encoding(value):
    """
    Strips broken characters that can't be represented at all
    in utf8. This prevents our parsers from breaking elsewhere.
    """
    if isinstance(value, unicode):
        value = value.encode('utf8', errors='replace')
    if isinstance(value, str):
        value = value.decode('utf8', errors='replace')
    return value


class Http(Interface):
    """
    The Request information is stored in the Http interface. Two arguments
    are required: ``url`` and ``method``.

    The ``env`` variable is a compounded dictionary of HTTP headers as well
    as environment information passed from the webserver. Sentry will explicitly
    look for ``REMOTE_ADDR`` in ``env`` for things which require an IP address.

    The ``data`` variable should only contain the request body (not the query
    string). It can either be a dictionary (for standard HTTP requests) or a
    raw request body.

    >>>  {
    >>>     "url": "http://absolute.uri/foo",
    >>>     "method": "POST",
    >>>     "data": "foo=bar",
    >>>     "query_string": "hello=world",
    >>>     "cookies": "foo=bar",
    >>>     "headers": [
    >>>         ["Content-Type", "text/html"]
    >>>     ],
    >>>     "env": {
    >>>         "REMOTE_ADDR": "192.168.0.1"
    >>>     }
    >>>  }

    .. note:: This interface can be passed as the 'request' key in addition
              to the full interface path.
    """
    display_score = 1000
    score = 800

    FORM_TYPE = 'application/x-www-form-urlencoded'

    @classmethod
    def to_python(cls, data):
        if not data.get('url'):
            raise InterfaceValidationError("No value for 'url'")

        kwargs = {}

        if data.get('method'):
            method = data['method'].upper()
            # Optimize for the common path here, where it's a GET/POST, falling
            # back to a regular expresion test
            if method not in ('GET', 'POST') and not http_method_re.match(method):
                raise InterfaceValidationError("Invalid value for 'method'")
            kwargs['method'] = method
        else:
            kwargs['method'] = None

        scheme, netloc, path, query_bit, fragment_bit = urlsplit(data['url'])

        query_string = data.get('query_string') or query_bit
        if query_string:
            # if querystring was a dict, convert it to a string
            if isinstance(query_string, dict):
                query_string = urlencode([(to_bytes(k), to_bytes(v))
                                          for k, v in query_string.items()])
            else:
                query_string = query_string
                if query_string[0] == '?':
                    # remove '?' prefix
                    query_string = query_string[1:]
            kwargs['query_string'] = trim(query_string, 4096)
        else:
            kwargs['query_string'] = ''

        fragment = data.get('fragment') or fragment_bit

        cookies = data.get('cookies')
        # if cookies were [also] included in headers we
        # strip them out
        headers = data.get('headers')
        if headers:
            headers, cookie_header = format_headers(headers)
            if not cookies and cookie_header:
                cookies = cookie_header
        else:
            headers = ()

        body = data.get('data')
        if isinstance(body, dict):
            body = json.dumps(body)

        if body:
            body = trim(body, settings.SENTRY_MAX_HTTP_BODY_SIZE)

        kwargs['cookies'] = trim_pairs(format_cookies(cookies))
        kwargs['env'] = trim_dict(data.get('env') or {})
        kwargs['headers'] = trim_pairs(headers)
        kwargs['data'] = fix_broken_encoding(body)
        kwargs['url'] = urlunsplit((scheme, netloc, path, '', ''))
        kwargs['fragment'] = trim(fragment, 1024)

        return cls(**kwargs)

    def get_path(self):
        return 'sentry.interfaces.Http'

    @property
    def full_url(self):
        url = self.url
        if self.query_string:
            url = url + '?' + self.query_string
        if self.fragment:
            url = url + '#' + self.fragment
        return url

    def to_email_html(self, event, **kwargs):
        return render_to_string('sentry/partial/interfaces/http_email.html', {
            'event': event,
            'url': self.full_url,
            'short_url': self.url,
            'method': self.method,
            'query_string': self.query_string,
            'fragment': self.fragment,
        })

    def get_alias(self):
        return 'request'

    def get_title(self):
        return _('Request')

    def get_api_context(self, is_public=False):
        data = self.data
        if isinstance(data, dict):
            data = json.dumps(data)

        cookies = self.cookies or ()
        if isinstance(cookies, dict):
            cookies = sorted(self.cookies.items())

        headers = self.headers or ()
        if isinstance(headers, dict):
            headers = sorted(self.headers.items())

        data = {
            'method': self.method,
            'url': self.url,
            'query': self.query_string,
            'fragment': self.fragment,
            'data': data,
            'headers': headers,
        }
        if not is_public:
            data.update({
                'cookies': cookies,
                'env': self.env or None,
            })
        return data
