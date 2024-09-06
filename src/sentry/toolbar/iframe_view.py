from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry.web.helpers import render_to_response


class IframeView(View):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest) -> HttpResponse:
        if request.method != "GET":
            return HttpResponse(status=405)

        response = render_to_response("sentry/toolbar/iframe.html")
        response["X-Frame-Options"] = "ALLOWALL"
        return response
