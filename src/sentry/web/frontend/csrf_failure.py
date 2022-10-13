import logging

import sentry_sdk
from django.middleware.csrf import REASON_NO_REFERER
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.web.helpers import render_to_response


class CsrfFailureView(View):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, reason="") -> Response:
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
                    logging.exception("CSRF failure for staff or superuser")
        return render_to_response("sentry/403-csrf-failure.html", context, request, status=403)


view = CsrfFailureView.as_view()
