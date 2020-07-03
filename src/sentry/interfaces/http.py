from __future__ import absolute_import
from sentry.utils.compat import map

__all__ = ("Http",)

import re
import six

from django.utils.translation import ugettext as _
from django.utils.http import urlencode
from six.moves.urllib.parse import parse_qsl

from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys
from sentry.utils import json
from sentry.utils.strings import to_unicode
from sentry.utils.safe import get_path
from sentry.web.helpers import render_to_string

# Instead of relying on a list of hardcoded methods, just loosely match
# against a pattern.
http_method_re = re.compile(r"^[A-Z\-_]{3,32}$")


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
            v = ", ".join(v)

        if k.lower() == "cookie":
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

    return [map(fix_broken_encoding, (k.strip(), v)) for k, v in value]


def fix_broken_encoding(value):
    """
    Strips broken characters that can't be represented at all
    in utf8. This prevents our parsers from breaking elsewhere.
    """
    if isinstance(value, six.text_type):
        value = value.encode("utf8", errors="replace")
    if isinstance(value, six.binary_type):
        value = value.decode("utf8", errors="replace")
    return value


def jsonify(value):
    return to_unicode(value) if isinstance(value, six.string_types) else json.dumps(value)


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
    path = "request"

    FORM_TYPE = "application/x-www-form-urlencoded"

    @classmethod
    def to_python(cls, data):
        data.setdefault("query_string", [])
        for key in (
            "method",
            "url",
            "fragment",
            "cookies",
            "headers",
            "data",
            "env",
            "inferred_content_type",
        ):
            data.setdefault(key, None)
        return cls(**data)

    def to_json(self):
        return prune_empty_keys(
            {
                "method": self.method,
                "url": self.url,
                "query_string": self.query_string or None,
                "fragment": self.fragment or None,
                "cookies": self.cookies or None,
                "headers": self.headers or None,
                "data": self.data,
                "env": self.env or None,
                "inferred_content_type": self.inferred_content_type,
            }
        )

    @property
    def full_url(self):
        url = self.url
        if url:
            if self.query_string:
                url = url + "?" + urlencode(get_path(self.query_string, filter=True))
            if self.fragment:
                url = url + "#" + self.fragment
        return url

    def to_email_html(self, event, **kwargs):
        return render_to_string(
            "sentry/partial/interfaces/http_email.html",
            {
                "event": event,
                "url": self.full_url,
                "short_url": self.url,
                "method": self.method,
                "query_string": urlencode(get_path(self.query_string, filter=True)),
                "fragment": self.fragment,
            },
        )

    def get_title(self):
        return _("Request")

    def get_api_context(self, is_public=False, platform=None):
        if is_public:
            return {}

        cookies = self.cookies or ()
        if isinstance(cookies, dict):
            cookies = sorted(self.cookies.items())

        headers = self.headers or ()
        if isinstance(headers, dict):
            headers = sorted(self.headers.items())

        data = {
            "method": self.method,
            "url": self.url,
            "query": self.query_string,
            "fragment": self.fragment,
            "data": self.data,
            "headers": headers,
            "cookies": cookies,
            "env": self.env or None,
            "inferredContentType": self.inferred_content_type,
        }
        return data

    def get_api_meta(self, meta, is_public=False, platform=None):
        if is_public:
            return None

        headers = meta.get("headers")
        if headers:
            headers_meta = headers.pop("", None)
            headers = {six.text_type(i): {"1": h[1]} for i, h in enumerate(sorted(headers.items()))}
            if headers_meta:
                headers[""] = headers_meta

        cookies = meta.get("cookies")
        if cookies:
            cookies_meta = cookies.pop("", None)
            cookies = {six.text_type(i): {"1": h[1]} for i, h in enumerate(sorted(cookies.items()))}
            if cookies_meta:
                cookies[""] = cookies_meta

        return {
            "": meta.get(""),
            "method": meta.get("method"),
            "url": meta.get("url"),
            "query": meta.get("query_string"),
            "data": meta.get("data"),
            "headers": headers,
            "cookies": cookies,
            "env": meta.get("env"),
        }
