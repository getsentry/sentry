from __future__ import absolute_import

from django.views.generic import View

from sentry.app import raven
from sentry.web.frontend.error_500 import Error500View


class DebugTriggerErrorView(View):
    def get(self, request):
        try:
            raise ValueError('An example error')
        except Exception:
            raven.captureException()

        return Error500View.as_view()(request)
