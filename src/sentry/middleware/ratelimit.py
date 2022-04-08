from __future__ import annotations

import logging
import uuid

from django.http.response import HttpResponse
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.ratelimits import (
    above_rate_limit_check,
    finish_request,
    get_rate_limit_key,
    get_rate_limit_value,
)
from sentry.ratelimits.config import ENFORCE_CONCURRENT_RATE_LIMITS
from sentry.types.ratelimit import RateLimitCategory, RateLimitMeta, RateLimitType

DEFAULT_ERROR_MESSAGE = (
    "You are attempting to use this endpoint too frequently. Limit is "
    "{limit} requests in {window} seconds"
)


class RatelimitMiddleware(MiddlewareMixin):
    """Middleware that applies a rate limit to every endpoint."""

    def process_view(self, request: Request, view_func, view_args, view_kwargs) -> Response | None:
        """Check if the endpoint call will violate."""
        try:
            # TODO: put these fields into their own object
            request.will_be_rate_limited = False
            request.rate_limit_category = None
            request.rate_limit_uid = uuid.uuid4().hex
            request.rate_limit_key = get_rate_limit_key(view_func, request)
            if request.rate_limit_key is None:
                return
            category_str = request.rate_limit_key.split(":", 1)[0]
            request.rate_limit_category = category_str

            rate_limit = get_rate_limit_value(
                http_method=request.method,
                endpoint=view_func.view_class,
                category=RateLimitCategory(category_str),
            )
            if rate_limit is None:
                return

            request.rate_limit_metadata = above_rate_limit_check(
                request.rate_limit_key, rate_limit, request.rate_limit_uid
            )
            # TODO: also limit by concurrent window once we have the data
            rate_limit_cond = (
                request.rate_limit_metadata.rate_limit_type != RateLimitType.NOT_LIMITED
                if ENFORCE_CONCURRENT_RATE_LIMITS
                else request.rate_limit_metadata.rate_limit_type == RateLimitType.FIXED_WINDOW
            )
            if rate_limit_cond:
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
        except Exception:
            logging.exception("Error during rate limiting, failing open. THIS SHOULD NOT HAPPEN")

    def process_response(self, request: Request, response: Response) -> Response:
        try:
            rate_limit_metadata: RateLimitMeta | None = getattr(
                request, "rate_limit_metadata", None
            )
            if rate_limit_metadata:
                response["X-Sentry-Rate-Limit-Remaining"] = rate_limit_metadata.remaining
                response["X-Sentry-Rate-Limit-Limit"] = rate_limit_metadata.limit
                response["X-Sentry-Rate-Limit-Reset"] = rate_limit_metadata.reset_time
                response[
                    "X-Sentry-Rate-Limit-ConcurrentRemaining"
                ] = rate_limit_metadata.concurrent_remaining
                response[
                    "X-Sentry-Rate-Limit-ConcurrentLimit"
                ] = rate_limit_metadata.concurrent_limit
            if hasattr(request, "rate_limit_key") and hasattr(request, "rate_limit_uid"):
                finish_request(request.rate_limit_key, request.rate_limit_uid)
        except Exception:
            logging.exception("COULD NOT POPULATE RATE LIMIT HEADERS")
        return response
