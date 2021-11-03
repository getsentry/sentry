# ratelimit.py
#
# Middleware that applies a rate limit to every endpoint


from __future__ import annotations

from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request

from sentry.api.helpers.group_index.index import EndpointFunction, build_rate_limit_key
from sentry.app import ratelimiter


def get_rate_limit_key(view_func: EndpointFunction, request: Request):
    """Construct a consistent global rate limit key using the arguments provided"""
    return build_rate_limit_key(view_func, request)


def get_default_rate_limit() -> tuple[int, int]:
    """Read a config file to the get the default rate limit based on the request property"""
    return 100, 1


def above_rate_limit_check(key, limit=None, window=None):
    if limit is None and window is None:
        limit, window = get_default_rate_limit()

    return ratelimiter.is_limited(key, limit=limit, window=window)


class RatelimitMiddleware(MiddlewareMixin):
    def _can_be_ratelimited(self, request: Request):
        return True

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Check if the endpoint call will violate"""
        if not self._can_be_ratelimited(request):
            return

        key = get_rate_limit_key(view_func, request)
        request.will_be_rate_limited = above_rate_limit_check(key)
        return
