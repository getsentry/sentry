from __future__ import annotations

from django.conf import settings
from django.http.response import HttpResponse
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request

from sentry.api.helpers.group_index.index import EndpointFunction
from sentry.models import SentryAppInstallationToken
from sentry.ratelimits import (
    above_rate_limit_check,
    can_be_ratelimited,
    get_rate_limit_key,
    get_rate_limit_value,
)
from sentry.types.ratelimit import RateLimitCategory


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

    ip_address = request.META.get("REMOTE_ADDR")

    request_auth = getattr(request, "auth", None)
    token_class = getattr(request_auth, "__class__", None)
    token_name = token_class.__name__ if token_class else None

    if token_name == "ApiToken" and is_sentry_app:
        category = "org"
        token = (
            SentryAppInstallationToken.objects.filter(api_token_id=request_auth.id)
            .select_related("sentry_app_installation")
            .first()
        )
        installation = getattr(token, "sentry_app_installation", None)
        id = getattr(installation, "organization_id", None)

    elif token_name == "ApiToken" and not is_sentry_app:
        category = "user"
        id = getattr(request_auth, "user_id", None)

    elif token_name == "ApiKey" and ip_address is not None:
        category = "ip"
        id = ip_address

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
