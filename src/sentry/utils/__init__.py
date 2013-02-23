"""
sentry.utils
~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.http import HttpRequest
from django.utils.encoding import force_unicode


class MockDjangoRequest(HttpRequest):
    GET = {}
    POST = {}
    META = {}
    COOKIES = {}
    FILES = {}
    raw_post_data = ''
    url = ''
    path = '/'
    plugins = []

    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    def __repr__(self):
        from pprint import pformat

        # Since this is called as part of error handling, we need to be very
        # robust against potentially malformed input.
        try:
            get = pformat(self.GET)
        except Exception:
            get = '<could not parse>'
        try:
            post = pformat(self.POST)
        except Exception:
            post = '<could not parse>'
        try:
            cookies = pformat(self.COOKIES)
        except Exception:
            cookies = '<could not parse>'
        try:
            meta = pformat(self.META)
        except Exception:
            meta = '<could not parse>'
        return '<Request\nGET:%s,\nPOST:%s,\nCOOKIES:%s,\nMETA:%s>' % \
            (get, post, cookies, meta)

    def build_absolute_uri(self):
        return self.url


def to_unicode(value):
    try:
        value = unicode(force_unicode(value))
    except (UnicodeEncodeError, UnicodeDecodeError):
        value = '(Error decoding value)'
    except Exception:  # in some cases we get a different exception
        try:
            value = str(repr(type(value)))
        except Exception:
            value = '(Error decoding value)'
    return value


def is_float(var):
    try:
        float(var)
    except ValueError:
        return False
    return True
