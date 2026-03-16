import hashlib
import logging

import sentry_sdk
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.middleware.csrf import REASON_NO_REFERER
from django.views.decorators.csrf import csrf_exempt

from sentry.web.frontend.base import all_silo_view
from sentry.web.helpers import render_to_response

logger = logging.getLogger(__name__)


@all_silo_view
@csrf_exempt
def view(request: HttpRequest, reason: str = "") -> HttpResponse:
    context = {"no_referer": reason == REASON_NO_REFERER}

    # Get CSRF token info for debugging
    csrf_cookie = request.COOKIES.get(settings.CSRF_COOKIE_NAME, "")
    csrf_post_token = request.POST.get("csrfmiddlewaretoken", "")

    extras = {
        "reason": reason,
        "path": request.path,
        "ip_address": request.META.get("REMOTE_ADDR"),
        "referer": request.META.get("HTTP_REFERER"),
        "origin": request.META.get("HTTP_ORIGIN"),
        "user_agent": request.META.get("HTTP_USER_AGENT"),
        "csrf_cookie_present": bool(csrf_cookie),
        "csrf_cookie_hash": (
            hashlib.sha256(csrf_cookie.encode()).hexdigest()[:8] if csrf_cookie else None
        ),
        "csrf_post_token_present": bool(csrf_post_token),
        "csrf_post_token_hash": (
            hashlib.sha256(csrf_post_token.encode()).hexdigest()[:8] if csrf_post_token else None
        ),
    }
    scope = sentry_sdk.get_isolation_scope()

    # Emit a sentry request that the incoming request is rejected by the CSRF protection.
    if hasattr(request, "user") and request.user.is_authenticated:
        is_staff = request.user.is_staff
        is_superuser = request.user.is_superuser

        extras["user_id"] = request.user.id
        extras["is_staff"] = is_staff
        extras["is_superuser"] = is_superuser

        if is_staff:
            scope.set_tag("is_staff", "yes")
        if is_superuser:
            scope.set_tag("is_superuser", "yes")
        if is_staff or is_superuser:
            scope.set_tag("csrf_failure", "yes")
            logging.error("CSRF failure for staff or superuser")

    logger.info("csrf_failure", extra=extras)
    return render_to_response("sentry/403-csrf-failure.html", context, request, status=403)
