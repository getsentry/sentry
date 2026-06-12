import sentry_sdk
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.conf.types.sentry_config import SentryMode
from sentry.web.frontend.base import all_silo_view
from sentry.web.helpers import render_to_response


@all_silo_view
class Error500View(View):
    def dispatch(self, request: HttpRequest) -> HttpResponse:
        error_id = sentry_sdk.last_event_id()
        self_hosted = settings.SENTRY_MODE == SentryMode.SELF_HOSTED

        return render_to_response(
            "sentry/500.html",
            context={"error_id": error_id, "is_self_hosted": self_hosted},
            status=500,
            request=request,
        )
