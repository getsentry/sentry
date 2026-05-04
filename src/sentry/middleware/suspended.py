from __future__ import annotations

import logging

import sentry_sdk
from django.http import HttpRequest, HttpResponseForbidden, JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger("sentry.auth.suspended")

SUSPENDED_EXEMPT_PATHS = frozenset(
    {
        "/auth/reactivate/",
        "/auth/login/",
        "/auth/logout/",
        "/api/0/auth/",
    }
)


class SuspendedUserMiddleware(MiddlewareMixin):
    """
    Safety net: if a suspended user somehow bypasses all auth guards
    and makes an authenticated request, block it and emit a Sentry alert.

    Under normal operation this middleware never fires — AuthenticationMiddleware
    already converts suspended users to AnonymousUser.
    """

    def process_request(self, request: HttpRequest) -> HttpResponseForbidden | JsonResponse | None:
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return None

        if not getattr(user, "is_suspended", False):
            return None

        for exempt_path in SUSPENDED_EXEMPT_PATHS:
            if request.path.startswith(exempt_path):
                return None

        logger.error(
            "suspended_user.safety_net_triggered",
            extra={
                "user_id": user.id,
                "path": request.path,
                "method": request.method,
                "ip_address": request.META.get("REMOTE_ADDR"),
            },
        )
        with sentry_sdk.isolation_scope() as scope:
            scope.set_extra("user_id", user.id)
            scope.set_extra("path", request.path)
            scope.set_extra("method", request.method)
            sentry_sdk.capture_message(
                "Suspended user bypassed auth guards",
                level="error",
            )

        if request.path.startswith("/api/"):
            return JsonResponse(
                {"detail": "Your account has been suspended."},
                status=403,
            )
        return HttpResponseForbidden("Your account has been suspended.")
