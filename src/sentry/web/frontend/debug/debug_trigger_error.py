from django.http import HttpRequest
from django.http.response import HttpResponseBase
from django.views.generic import View

from sentry.utils.sdk import capture_exception
from sentry.web.frontend.base import internal_region_silo_view
from sentry.web.frontend.error_500 import Error500View


@internal_region_silo_view
class DebugTriggerErrorView(View):
    def get(self, request: HttpRequest) -> HttpResponseBase:
        try:
            raise ValueError("An example error")
        except Exception:
            capture_exception()

        return Error500View.as_view()(request)
