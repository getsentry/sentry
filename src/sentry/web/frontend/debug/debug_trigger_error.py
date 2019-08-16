from __future__ import absolute_import

from django.views.generic import View

from sentry.web.frontend.error_500 import Error500View
from sentry.utils.sdk import capture_exception


class DebugTriggerErrorView(View):
    def get(self, request):
        try:
            raise ValueError("An example error")
        except Exception:
            capture_exception()

        return Error500View.as_view()(request)
