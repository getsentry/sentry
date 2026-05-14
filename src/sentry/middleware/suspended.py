from __future__ import annotations

import logging

from django.conf import settings
from django.http import HttpRequest, HttpResponseForbidden, JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger("sentry.auth.suspended")

SUSPENDED_EXEMPT_PATHS = (
    "/auth/reactivate/",
    "/auth/login/",
    "/auth/logout/",
    "/api/0/auth/login/",
)


class SuspendedUserMiddleware(MiddlewareMixin):
    """
    Safety net: if a suspended user somehow bypasses all auth guards
    and makes an authenticated request, block it and emit a Sentry alert.

    Under normal operation this middleware never fires — AuthenticationMiddleware
    already converts suspended users to AnonymousUser.
    """

    def process_request(self, request: HttpRequest) -> HttpResponseForbidden | JsonResponse | None:
        if request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES):
            return None

        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return None

        if not getattr(user, "is_suspended", False):
            return None

        if any(request.path_info.startswith(p) for p in SUSPENDED_EXEMPT_PATHS):
            return None

        # Allow logout (DELETE /api/0/auth/) so suspended users can end their session.
        if request.path_info == "/api/0/auth/" and request.method == "DELETE":
            return None

        logger.error(
            "suspended_user.safety_net_triggered",
            extra={
                "user_id": user.id,
                "path": request.path_info,
                "method": request.method,
                "ip_address": request.META.get("REMOTE_ADDR"),
            },
        )

        if request.path_info.startswith("/api/"):
            return JsonResponse(
                {"detail": "Your account has been suspended."},
                status=403,
            )
        return HttpResponseForbidden("Your account has been suspended.")
