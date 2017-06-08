from __future__ import absolute_import, unicode_literals

from django.utils.translation import ugettext_lazy as _

from debug_toolbar.compat import OrderedDict
from debug_toolbar.panels import Panel


class HeadersPanel(Panel):
    """
    A panel to display HTTP headers.
    """
    # List of environment variables we want to display
    ENVIRON_FILTER = set((
        'CONTENT_LENGTH',
        'CONTENT_TYPE',
        'DJANGO_SETTINGS_MODULE',
        'GATEWAY_INTERFACE',
        'QUERY_STRING',
        'PATH_INFO',
        'PYTHONPATH',
        'REMOTE_ADDR',
        'REMOTE_HOST',
        'REQUEST_METHOD',
        'SCRIPT_NAME',
        'SERVER_NAME',
        'SERVER_PORT',
        'SERVER_PROTOCOL',
        'SERVER_SOFTWARE',
        'TZ',
    ))

    title = _("Headers")

    template = 'debug_toolbar/panels/headers.html'

    def process_request(self, request):
        wsgi_env = list(sorted(request.META.items()))
        self.request_headers = OrderedDict(
            (unmangle(k), v) for (k, v) in wsgi_env if is_http_header(k))
        if 'Cookie' in self.request_headers:
            self.request_headers['Cookie'] = '=> see Request panel'
        self.environ = OrderedDict(
            (k, v) for (k, v) in wsgi_env if k in self.ENVIRON_FILTER)
        self.record_stats({
            'request_headers': self.request_headers,
            'environ': self.environ,
        })

    def process_response(self, request, response):
        self.response_headers = OrderedDict(sorted(response.items()))
        self.record_stats({
            'response_headers': self.response_headers,
        })


def is_http_header(wsgi_key):
    # The WSGI spec says that keys should be str objects in the environ dict,
    # but this isn't true in practice. See issues #449 and #482.
    return isinstance(wsgi_key, str) and wsgi_key.startswith('HTTP_')


def unmangle(wsgi_key):
    return wsgi_key[5:].replace('_', '-').title()
