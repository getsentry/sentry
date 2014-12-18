from __future__ import absolute_import, print_function

from sentry.web.helpers import render_to_response
from sentry.web.frontend.base import BaseView


class HelpPlatformIndexView(BaseView):
    auth_required = False

    def get(self, request):
        try:
            pid = int(request.GET.get('pid', 0))
        except (TypeError, ValueError):
            pid = None

        if pid:
            request.session['pid'] = pid

        return render_to_response('sentry/help/platform_index.html', {}, request)
