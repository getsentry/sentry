from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils.sdk import capture_exception
from sentry.web.frontend.error_500 import Error500View


class DebugTriggerErrorView(View):
    def get(self, request: Request) -> Response:
        try:
            raise ValueError("An example error")
        except Exception:
            capture_exception()

        return Error500View.as_view()(request)
