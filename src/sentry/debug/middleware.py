from __future__ import absolute_import

import json
import re
import threading

from debug_toolbar.middleware import DebugToolbarMiddleware
from debug_toolbar.toolbar import DebugToolbar
from django.utils.encoding import force_text


# Inherit from DebugToolbarMiddleware because of DJDT monkey patching
class DebugMiddleware(threading.local, DebugToolbarMiddleware):
    _body_regexp = re.compile(re.escape('</body>'), flags=re.IGNORECASE)

    def __init__(self):
        threading.local.__init__(self)

    def show_toolbar(self, request):
        # TODO(dcramer): support VPN via INTERNAL_IPS + ipaddr maps
        if not request.user.is_authenticated():
            return False
        if not request.user.is_active_superuser():
            return False
        if 'text/html' not in request.META.get('HTTP_ACCEPT', '*/*'):
            return False
        return True

    def process_request(self, request):
        # Decide whether the toolbar is active for this request.
        if not self.show_toolbar(request):
            self.toolbar = None
            return

        self.toolbar = toolbar = DebugToolbar(request)

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
        toolbar = getattr(self, 'toolbar', None)
        if not toolbar:
            return

        # Run process_view methods of panels like Django middleware.
        response = None
        for panel in toolbar.enabled_panels:
            response = panel.process_view(request, view_func, view_args, view_kwargs)
            if response:
                break

    def process_response(self, request, response):
        toolbar = getattr(self, 'toolbar', None)
        if not toolbar:
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
        if toolbar.config['SHOW_COLLAPSED'] and 'djdt' not in request.COOKIES:
            response.set_cookie('djdt', 'hide', 864000)

        content = force_text(response.content, encoding='utf-8')
        if 'text/html' not in response['Content-Type']:
            if 'application/json' in response['Content-Type']:
                content = json.dumps(json.loads(content), indent=2)
            response['Content-Type'] = 'text/html'
            response.content = '<body><h1>Debugger</h1><pre>{}</pre></body>'.format(content)

        # Insert the toolbar in the response.
        bits = self._body_regexp.split(content)
        if len(bits) > 1:
            bits[-2] += toolbar.render_toolbar()
            print(bits)
            response.content = '</body>'.join(bits)

        response['Content-Length'] = len(response.content)
        return response
