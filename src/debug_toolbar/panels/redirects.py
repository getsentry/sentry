from __future__ import absolute_import, unicode_literals

from django.core.handlers.wsgi import STATUS_CODE_TEXT
from django.shortcuts import render_to_response
from django.utils.translation import ugettext_lazy as _

from debug_toolbar.panels import Panel


class RedirectsPanel(Panel):
    """
    Panel that intercepts redirects and displays a page with debug info.
    """

    has_content = False

    nav_title = _("Intercept redirects")

    def process_response(self, request, response):
        if 300 <= int(response.status_code) < 400:
            redirect_to = response.get('Location', None)
            if redirect_to:
                try:        # Django >= 1.6
                    reason_phrase = response.reason_phrase
                except AttributeError:
                    reason_phrase = STATUS_CODE_TEXT.get(response.status_code,
                                                         'UNKNOWN STATUS CODE')
                status_line = '%s %s' % (response.status_code, reason_phrase)
                cookies = response.cookies
                context = {'redirect_to': redirect_to, 'status_line': status_line}
                response = render_to_response('debug_toolbar/redirect.html', context)
                response.cookies = cookies
        return response
