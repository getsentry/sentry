from __future__ import annotations

from django.http.response import HttpResponse
from django.utils.deprecation import MiddlewareMixin

from sentry.ratelimits import (
    above_rate_limit_check,
    can_be_ratelimited,
    get_rate_limit_key,
    get_rate_limit_value,
)
from sentry.types.ratelimit import RateLimitCategory


class RatelimitMiddleware(MiddlewareMixin):
    """Middleware that applies a rate limit to every endpoint."""

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Check if the endpoint call will violate."""
        request.will_be_rate_limited = False

        if not can_be_ratelimited(request, view_func):
            return

        key = get_rate_limit_key(view_func, request)
        if key is None:
            return

        rate_limit = get_rate_limit_value(
            http_method=request.method,
            endpoint=view_func.view_class,
            category=RateLimitCategory(key.split(":", 1)[0]),
        )
        if rate_limit is None:
            return

        rate_limit_check_dict = above_rate_limit_check(key, rate_limit)
        if rate_limit_check_dict["is_limited"]:
            request.will_be_rate_limited = True
            enforce_rate_limit = getattr(view_func.view_class, "enforce_rate_limit", False)
            if enforce_rate_limit:
                return HttpResponse(
                    {
                        "detail": f"You are attempting to use this endpoint too frequently. "
                        f"Limit is {rate_limit_check_dict['limit']} requests in "
                        f"{rate_limit_check_dict['window']} seconds"
                    },
                    status=429,
                )
