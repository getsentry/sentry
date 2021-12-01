from __future__ import annotations

from django.utils.deprecation import MiddlewareMixin

from sentry.ratelimits import (
    above_rate_limit_check,
    can_be_ratelimited,
    get_rate_limit_key,
    get_rate_limit_value,
)


class RatelimitMiddleware(MiddlewareMixin):
    """Middleware that applies a rate limit to every endpoint."""

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Check if the endpoint call will violate"""
        if not can_be_ratelimited(request, view_func):
            request.will_be_rate_limited = False
            return

        key = get_rate_limit_key(view_func, request)
        if key is not None:
            category = key.split(":", 1)[0]
            rate_limit = get_rate_limit_value(request.method, view_func.view_class, category)
            request.will_be_rate_limited = (
                above_rate_limit_check(key, rate_limit)["is_limited"]
                if rate_limit is not None
                else False
            )
        return
