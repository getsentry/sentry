"""
sentry.interfaces.http
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Http', )

import re
import six

from django.conf import settings
from django.utils.translation import ugettext as _
from six.moves.urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.utils.safe import trim, trim_dict, trim_pairs
from sentry.utils.http import heuristic_decode
from sentry.utils.validators import validate_ip
from sentry.web.helpers import render_to_string

# Instead of relying on a list of hardcoded methods, just loosly match
# against a pattern.
http_method_re = re.compile(r'^[A-Z\-_]{3,32}$')


def to_bytes(value):
    if isinstance(value, six.text_type):
        return value.encode('utf-8')
    return six.binary_type(value)


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
            if not isinstance(v, six.string_types):
                v = six.text_type(v)
            result.append((k.title(), v))
    return result, cookie_header


def format_cookies(value):
    if not value:
        return ()

    if isinstance(value, six.string_types):
        value = parse_qsl(value, keep_blank_values=True)

    if isinstance(value, dict):
        value = value.items()

    return [list(map(fix_broken_encoding, (k.strip(), v))) for k, v in value]


def fix_broken_encoding(value):
    """
    Strips broken characters that can't be represented at all
    in utf8. This prevents our parsers from breaking elsewhere.
    """
    if isinstance(value, six.text_type):
        value = value.encode('utf8', errors='replace')
    if isinstance(value, six.binary_type):
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
    path = 'sentry.interfaces.Http'

    FORM_TYPE = 'application/x-www-form-urlencoded'

    @classmethod
    def to_python(cls, data):
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid interface data")

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
                query_string = urlencode(
                    [(to_bytes(k), to_bytes(v)) for k, v in query_string.items()]
                )
            else:
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

        # We prefer the body to be a string, since we can then attempt to parse it
        # as JSON OR decode it as a URL encoded query string, without relying on
        # the correct content type header being passed.
        body = data.get('data')

        content_type = next((v for k, v in headers if k == 'Content-Type'), None)

        # Remove content type parameters
        if content_type is not None:
            content_type = content_type.partition(';')[0].rstrip()

        # We process request data once during ingestion and again when
        # requesting the http interface over the API. Avoid overwriting
        # decoding the body again.
        inferred_content_type = data.get('inferred_content_type', content_type)

        if 'inferred_content_type' not in data and not isinstance(body, dict):
            body, inferred_content_type = heuristic_decode(body, content_type)

        if body:
            body = trim(body, settings.SENTRY_MAX_HTTP_BODY_SIZE)

        env = data.get('env', {})
        # TODO (alex) This could also be accomplished with schema (with formats)
        if 'REMOTE_ADDR' in env:
            try:
                validate_ip(env['REMOTE_ADDR'], required=False)
            except ValueError:
                del env['REMOTE_ADDR']

        kwargs['inferred_content_type'] = inferred_content_type
        kwargs['cookies'] = trim_pairs(format_cookies(cookies))
        kwargs['env'] = trim_dict(env)
        kwargs['headers'] = trim_pairs(headers)
        kwargs['data'] = fix_broken_encoding(body)
        kwargs['url'] = urlunsplit((scheme, netloc, path, '', ''))
        kwargs['fragment'] = trim(fragment, 1024)

        return cls(**kwargs)

    def get_path(self):
        return self.path

    @property
    def full_url(self):
        url = self.url
        if self.query_string:
            url = url + '?' + self.query_string
        if self.fragment:
            url = url + '#' + self.fragment
        return url

    def to_email_html(self, event, **kwargs):
        return render_to_string(
            'sentry/partial/interfaces/http_email.html', {
                'event': event,
                'url': self.full_url,
                'short_url': self.url,
                'method': self.method,
                'query_string': self.query_string,
                'fragment': self.fragment,
            }
        )

    def get_alias(self):
        return 'request'

    def get_title(self):
        return _('Request')

    def get_api_context(self, is_public=False):
        if is_public:
            return {}

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
            'data': self.data,
            'headers': headers,
            'cookies': cookies,
            'env': self.env or None,
            'inferredContentType': self.inferred_content_type,
        }
        return data

    def get_api_meta(self, meta, is_public=False):
        if is_public:
            return None

        return {
            'method': meta.get('method'),
            'url': meta.get('url'),
            'query': meta.get('query_string'),
            'data': meta.get('data'),
            'env': meta.get('env'),

            # NOTE: Headers and cookies are a sorted list of lists in the API
            # context, but remain a dictionary here.
            'headers': meta.get('headers'),
            'cookies': meta.get('cookies'),
        }
