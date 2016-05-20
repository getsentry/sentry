from __future__ import absolute_import

from django.conf import settings
from django.views.generic import View

from sentry.models import ProjectKey
from sentry.web.helpers import render_to_response


class DebugIconsView(View):
    def get(self, request):
        return render_to_response('sentry/debug/icons.html', request)
