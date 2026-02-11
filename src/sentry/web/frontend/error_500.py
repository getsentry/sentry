from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.web.frontend.base import all_silo_view
from sentry.web.helpers import render_to_response


@all_silo_view
class Error500View(View):
    def dispatch(self, request: HttpRequest) -> HttpResponse:
        return render_to_response("sentry/500.html", status=500, request=request)
