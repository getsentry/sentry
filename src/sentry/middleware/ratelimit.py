from __future__ import annotations

from django.http.response import HttpResponse
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.ratelimits import above_rate_limit_check, get_rate_limit_key, get_rate_limit_value
from sentry.types.ratelimit import RateLimitCategory

DEFAULT_ERROR_MESSAGE = (
    "You are attempting to use this endpoint too frequently. Limit is "
    "{limit} requests in {window} seconds"
)


class RatelimitMiddleware(MiddlewareMixin):
    """Middleware that applies a rate limit to every endpoint."""

    def process_view(self, request: Request, view_func, view_args, view_kwargs) -> Response | None:
        """Check if the endpoint call will violate."""
        request.will_be_rate_limited = False
        request.rate_limit_category = None

        key = get_rate_limit_key(view_func, request)
        if key is None:
            return
        category_str = key.split(":", 1)[0]
        request.rate_limit_category = category_str

        rate_limit = get_rate_limit_value(
            http_method=request.method,
            endpoint=view_func.view_class,
            category=RateLimitCategory(category_str),
        )
        if rate_limit is None:
            return

        request.rate_limit_metadata = above_rate_limit_check(key, rate_limit)

        if request.rate_limit_metadata.is_limited:
            request.will_be_rate_limited = True
            enforce_rate_limit = getattr(view_func.view_class, "enforce_rate_limit", False)
            if enforce_rate_limit:
                return HttpResponse(
                    {
                        "detail": DEFAULT_ERROR_MESSAGE.format(
                            limit=request.rate_limit_metadata.limit,
                            window=request.rate_limit_metadata.window,
                        )
                    },
                    status=429,
                )

    def process_response(self, request: Request, response: Response) -> Response:
        if hasattr(request, "rate_limit_metadata"):
            response["X-Sentry-Rate-Limit-Remaining"] = request.rate_limit_metadata.remaining
            response["X-Sentry-Rate-Limit-Limit"] = request.rate_limit_metadata.limit
            response["X-Sentry-Rate-Limit-Reset"] = request.rate_limit_metadata.reset_time
        return response
