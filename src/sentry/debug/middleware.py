from __future__ import absolute_import

import json
import re

from debug_toolbar.toolbar import DebugToolbar
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.encoding import force_text
from six.moves import _thread as thread


class ToolbarCache(object):
    def __init__(self):
        self._toolbars = {}

    def create(self, request):
        toolbar = DebugToolbar(request)
        self._toolbars[thread.get_ident()] = toolbar
        return toolbar

    def pop(self):
        return self._toolbars.pop(thread.get_ident(), None)

    def get(self):
        return self._toolbars.get(thread.get_ident(), None)

toolbar_cache = ToolbarCache()


class DebugMiddleware(object):
    _body_regexp = re.compile(re.escape('</body>'), flags=re.IGNORECASE)

    def show_toolbar_for_request(self, request):
        # TODO(dcramer): support VPN via INTERNAL_IPS + ipaddr maps
        if not settings.SENTRY_DEBUGGER:
            return False
        if not request.is_superuser():
            return False
        if 'text/html' not in request.META.get('HTTP_ACCEPT', '*/*'):
            return False
        return True

    def show_toolbar_for_response(self, response):
        content_type = response['Content-Type']
        for type in ('text/html', 'application/json'):
            if type in content_type:
                return True
        return False

    def process_request(self, request):
        # Decide whether the toolbar is active for this request.
        if not self.show_toolbar_for_request(request):
            return

        toolbar = toolbar_cache.create(request)

        # Activate instrumentation ie. monkey-patch.
        for panel in toolbar.enabled_panels:
            panel.enable_instrumentation()

        # Run process_request methods of panels like Django middleware.
        response = None
        for panel in toolbar.enabled_panels:
            response = panel.process_request(request)
            if response:
                break
        return response

    def process_view(self, request, view_func, view_args, view_kwargs):
        toolbar = toolbar_cache.get()
        if not toolbar:
            return

        # Run process_view methods of panels like Django middleware.
        response = None
        for panel in toolbar.enabled_panels:
            response = panel.process_view(request, view_func, view_args, view_kwargs)
            if response:
                break

    def process_response(self, request, response):
        toolbar = toolbar_cache.pop()
        if not toolbar:
            return response

        if not self.show_toolbar_for_response(response):
            return response

        # Run process_response methods of panels like Django middleware.
        for panel in reversed(toolbar.enabled_panels):
            new_response = panel.process_response(request, response)
            if new_response:
                response = new_response

        # Deactivate instrumentation ie. monkey-unpatch. This must run
        # regardless of the response. Keep 'return' clauses below.
        # (NB: Django's model for middleware doesn't guarantee anything.)
        for panel in reversed(toolbar.enabled_panels):
            panel.disable_instrumentation()

        # Collapse the toolbar by default if SHOW_COLLAPSED is set.
        if 'djdt' in request.COOKIES:
            response.delete_cookie('djdt')

        try:
            content = force_text(response.content, encoding='utf-8')
        except UnicodeDecodeError:
            # Make sure we at least just return a response on an encoding issue
            return response

        if 'text/html' not in response['Content-Type']:
            if 'application/json' in response['Content-Type']:
                content = json.dumps(json.loads(content), indent=2)
            content = render_to_string('debug_toolbar/wrapper.html', {
                'content': content,
            })
            response['Content-Type'] = 'text/html'

        # Insert the toolbar in the response.
        bits = self._body_regexp.split(content)
        if len(bits) > 1:
            bits[-2] += toolbar.render_toolbar()
            content = '</body>'.join(bits)

        response.content = content
        response['Content-Length'] = len(content)
        return response
