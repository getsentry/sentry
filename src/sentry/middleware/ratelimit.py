"""Middleware that applies a rate limit to every endpoint."""


from __future__ import annotations

from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.helpers.group_index.index import EndpointFunction
from sentry.app import ratelimiter
from sentry.types.ratelimit import RateLimit


def get_rate_limit_key(view_func: EndpointFunction, request: Request) -> str | None:
    """Construct a consistent global rate limit key using the arguments provided"""

    view = view_func.__qualname__
    http_method = request.method

    # This avoids touching user session, which means we avoid
    # setting `Vary: Cookie` as a response header which will
    # break HTTP caching entirely.
    if request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES):
        return None

    request_user = getattr(request, "user", None)
    user_id = getattr(request_user, "id", None)
    is_sentry_app = getattr(request_user, "is_sentry_app", None)

    request_access = getattr(request, "access", None)
    org_id = getattr(request_access, "organization_id", None)

    ip_address = request.META.get("REMOTE_ADDR")

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


def get_rate_limit_value(http_method: str, endpoint: Endpoint, category: str) -> RateLimit | None:
    """
    Read the rate limit from the view function to be used for the rate limit check
    """
    rate_limit_lookup_dict = getattr(endpoint, "rate_limits", None)

    # if the endpoint doesn't have a rate limit property, then it isn't a subclass to our Endpoint
    # it should not be rate limited
    if rate_limit_lookup_dict is None:
        return None
    rate_limits = rate_limit_lookup_dict.get(http_method, settings.SENTRY_RATELIMITER_DEFAULTS)
    return rate_limits.get(category, settings.SENTRY_RATELIMITER_DEFAULTS[category])


def above_rate_limit_check(key: str, rate_limit: RateLimit):
    is_limited, current = ratelimiter.is_limited_with_value(
        key, limit=rate_limit.limit, window=rate_limit.window
    )
    return {
        "is_limited": is_limited,
        "current": current,
        "limit": rate_limit.limit,
        "window": rate_limit.window,
    }


class RatelimitMiddleware(MiddlewareMixin):
    def _can_be_ratelimited(self, request: Request, view_func: EndpointFunction):
        return hasattr(view_func, "view_class") and not request.path_info.startswith(
            settings.ANONYMOUS_STATIC_PREFIXES
        )

    def process_view(self, request, view_func, view_args, view_kwargs):
        """Check if the endpoint call will violate"""
        if not self._can_be_ratelimited(request, view_func):
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
