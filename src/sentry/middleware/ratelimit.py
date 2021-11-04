# ratelimit.py
#
# Middleware that applies a rate limit to every endpoint


from __future__ import annotations

from typing import Literal

from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request

from sentry.api.helpers.group_index.index import EndpointFunction
from sentry.app import ratelimiter


def get_rate_limit_key(
    view_func: EndpointFunction, request: Request, category: Literal["org", "user", "ip"] = "ip"
):
    """Construct a consistent global rate limit key using the arguments provided"""

    view = view_func.__name__
    http_method = request.method

    # Default to using an IP based ratelimit
    if category == "org":
        request_access = getattr(request, "access", None)
        id = getattr(request_access, "organization_id", None)

    elif category == "user":
        request_user = getattr(request, "user", None)
        id = getattr(request_user, "id", None)
    else:
        id = request.META["REMOTE_ADDR"]

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
        request.will_be_rate_limited = above_rate_limit_check(key)["is_limited"]
        return
