import logging

import sentry_sdk
from django.http import HttpRequest, HttpResponse
from django.middleware.csrf import REASON_NO_REFERER
from django.views.decorators.csrf import csrf_exempt

from sentry.web.helpers import render_to_response


@csrf_exempt
def view(request: HttpRequest, reason: str = "") -> HttpResponse:
    context = {"no_referer": reason == REASON_NO_REFERER}
    with sentry_sdk.configure_scope() as scope:
        # Emit a sentry request that the incoming request is rejected by the CSRF protection.
        if hasattr(request, "user") and request.user.is_authenticated:
            is_staff = request.user.is_staff
            is_superuser = request.user.is_superuser
            if is_staff:
                scope.set_tag("is_staff", "yes")
            if is_superuser:
                scope.set_tag("is_superuser", "yes")
            if is_staff or is_superuser:
                scope.set_tag("csrf_failure", "yes")
                logging.error("CSRF failure for staff or superuser")
    return render_to_response("sentry/403-csrf-failure.html", context, request, status=403)
