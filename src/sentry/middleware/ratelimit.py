# ratelimit.py
#
# Middleware that applies a rate limit to every endpoint


from __future__ import annotations

from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request

from sentry.api.helpers.group_index.index import EndpointFunction
from sentry.app import ratelimiter


def get_rate_limit_key(view_func: EndpointFunction, request: Request) -> str | None:
    """Construct a consistent global rate limit key using the arguments provided"""

    view = f"{view_func.__module__}.{view_func.__name__}"
    http_method = request.method

    request_user = getattr(request, "user", None)
    user_id = getattr(request_user, "id", None)
    is_sentry_app = getattr(request_user, "is_sentry_app", None)

    request_access = getattr(request, "access", None)
    org_id = getattr(request_access, "organization_id", None)

    ip_address = request.META.get("REMOTE_ADDR")

    # Default to using an IP based ratelimit
    if is_sentry_app and org_id is not None:
        category = "org"
        id = org_id
    elif user_id is not None:
        category = "user"
        id = user_id
    elif ip_address is not None:
        category = "ip"
        id = ip_address
    # If IP address doesn't exist, skip ratelimiting for now
    else:
        return None
    return f"{category}:{view}:{http_method}:{id}"


def get_default_rate_limit() -> tuple[int, int]:
    """
    Read the rate limit from the view function to be used for the rate limit check
    """

    # TODO: Remove hard coded value with actual function logic
    return 100, 1


def above_rate_limit_check(key, limit=None, window=None):
    if limit is None:
        limit, window = get_default_rate_limit()

    is_limited, current = ratelimiter.is_limited_with_value(key, limit=limit, window=window)
    return {
        "is_limited": is_limited,
        "current": current,
        "limit": limit,
        "window": window,
    }


class RatelimitMiddleware(MiddlewareMixin):
    def _can_be_ratelimited(self, request: Request):
        return True

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Check if the endpoint call will violate"""
        if not self._can_be_ratelimited(request):
            return

        key = get_rate_limit_key(view_func, request)
        request.will_be_rate_limited = (
            above_rate_limit_check(key)["is_limited"] if key is not None else False
        )
        return
