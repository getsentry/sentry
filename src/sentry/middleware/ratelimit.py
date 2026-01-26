from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from math import ceil

import orjson
import sentry_sdk
from django.conf import settings
from django.http.request import HttpRequest
from django.http.response import HttpResponse, HttpResponseBase

from sentry.api.base import apply_cors_headers
from sentry.ratelimits import (
    above_rate_limit_check,
    finish_request,
    get_rate_limit_config,
    get_rate_limit_key,
    get_rate_limit_value,
)
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory, RateLimitMeta, RateLimitType
from sentry.utils import metrics

DEFAULT_ERROR_MESSAGE = (
    "You are attempting to use this endpoint too frequently. Limit is "
    "{limit} requests in {window} seconds"
)
DEFAULT_CONCURRENT_ERROR_MESSAGE = (
    "You are attempting to go above the allowed concurrency for this endpoint. Concurrency limit is "
    "{limit}"
)
logger = logging.getLogger("sentry.api.rate-limit")


def _normalize_and_min_limit(a_limit: int, a_window: int, b_limit: int, b_window: int) -> int:
    """Normalize two (limit, window) pairs and return the minimum of the two normalized values."""
    norm_a = a_limit / a_window if a_window and a_window >= 1 else a_limit
    norm_b = b_limit / b_window if b_window and b_window >= 1 else b_limit

    # Take the ceiling of the normalized values to ensure that the values are at least 1
    return min(ceil(norm_a), ceil(norm_b))


class RatelimitMiddleware:
    """Middleware that applies a rate limit to every endpoint.
    See: https://docs.djangoproject.com/en/4.0/topics/http/middleware/#writing-your-own-middleware
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        # process_view is automatically called by Django
        with sentry_sdk.start_span(op="ratelimit.__call__"):
            response = self.get_response(request)
            self.process_response(request, response)
            return response

    def _apply_impersonation_limits(self, rate_limit_config: RateLimitConfig) -> RateLimitConfig:
        """Takes the minimum between the impersonation_limit and the API's rate limit configuration
        for each HTTP method and category.
        """

        impersonation_limit = settings.SENTRY_IMPERSONATION_RATE_LIMIT

        # Create one set of limits to use for all HTTP methods
        # For each method and category, take the min between impersonation_limit and API's limit
        limit_overrides = {}
        for method in ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]:
            method_limits = {}

            for category in RateLimitCategory:
                api_rate_limit = rate_limit_config.get_rate_limit(method, category)

                # Normalize limits to 1 second window and take the minimum. We will use the
                # normalized values to set the new lower rate limit.
                if api_rate_limit.limit:
                    min_limit = _normalize_and_min_limit(
                        api_rate_limit.limit, api_rate_limit.window, impersonation_limit, 1
                    )
                else:
                    min_limit = impersonation_limit

                if api_rate_limit.concurrent_limit:
                    min_concurrent_limit = min(api_rate_limit.concurrent_limit, impersonation_limit)
                else:
                    min_concurrent_limit = impersonation_limit

                method_limits[category] = RateLimit(
                    limit=min_limit,
                    window=1,  # All limits are already normalized to 1 second windows
                    concurrent_limit=min_concurrent_limit,
                )
            limit_overrides[method] = method_limits

        return RateLimitConfig(
            group=rate_limit_config.group,
            limit_overrides=limit_overrides,
        )

    def process_view(
        self, request: HttpRequest, view_func, view_args, view_kwargs
    ) -> HttpResponseBase | None:
        """Check if the endpoint call will violate."""
        with metrics.timer("middleware.ratelimit.process_view", sample_rate=0.01):
            try:
                # TODO: put these fields into their own object
                request.will_be_rate_limited = False
                if settings.SENTRY_SELF_HOSTED:
                    return None
                request.rate_limit_category = None
                request.rate_limit_uid = uuid.uuid4().hex
                view_class = getattr(view_func, "view_class", None)
                if not view_class:
                    return None

                # Check for impersonation
                is_impersonating = getattr(request, "actual_user", None) is not None

                enforce_rate_limit = getattr(view_class, "enforce_rate_limit", False)
                # Always enforce rate limits during impersonation sessions
                if is_impersonating and not enforce_rate_limit:
                    enforce_rate_limit = True

                if enforce_rate_limit is False:
                    return None

                rate_limit_config = get_rate_limit_config(
                    view_class, view_args, {**view_kwargs, "request": request}
                )

                # Apply stricter limits during impersonation
                if is_impersonating:
                    rate_limit_config = self._apply_impersonation_limits(rate_limit_config)

                rate_limit_group = (
                    rate_limit_config.group if rate_limit_config else RateLimitConfig().group
                )
                request.rate_limit_key = get_rate_limit_key(
                    view_func, request, rate_limit_group, rate_limit_config
                )
                if request.rate_limit_key is None:
                    return None

                category_str = request.rate_limit_key.split(":", 1)[0]
                request.rate_limit_category = category_str

                rate_limit = get_rate_limit_value(
                    http_method=request.method,
                    category=RateLimitCategory(category_str),
                    rate_limit_config=rate_limit_config,
                )
                if rate_limit is None:
                    return None

                request.rate_limit_metadata = above_rate_limit_check(
                    request.rate_limit_key, rate_limit, request.rate_limit_uid, rate_limit_group
                )

                # TODO: also limit by concurrent window once we have the data
                rate_limit_cond = (
                    request.rate_limit_metadata.rate_limit_type != RateLimitType.NOT_LIMITED
                    if settings.ENFORCE_CONCURRENT_RATE_LIMITS
                    else request.rate_limit_metadata.rate_limit_type == RateLimitType.FIXED_WINDOW
                )
                if rate_limit_cond:
                    request.will_be_rate_limited = True
                    logger.info(
                        "sentry.api.rate-limit.exceeded",
                        extra={
                            "key": request.rate_limit_key,
                            "url": request.build_absolute_uri(),
                            "limit": request.rate_limit_metadata.limit,
                            "window": request.rate_limit_metadata.window,
                        },
                    )
                    if request.rate_limit_metadata.rate_limit_type == RateLimitType.FIXED_WINDOW:
                        response_text = DEFAULT_ERROR_MESSAGE.format(
                            limit=request.rate_limit_metadata.limit,
                            window=request.rate_limit_metadata.window,
                        )
                    else:
                        response_text = DEFAULT_CONCURRENT_ERROR_MESSAGE.format(
                            limit=request.rate_limit_metadata.concurrent_limit
                        )

                    response_json = {
                        "detail": response_text,
                    }

                    response = HttpResponse(orjson.dumps(response_json), status=429)
                    assert request.method is not None
                    return apply_cors_headers(
                        request=request, response=response, allowed_methods=[request.method]
                    )
            except Exception:
                logging.exception(
                    "Error during rate limiting, failing open. THIS SHOULD NOT HAPPEN"
                )
        return None

    def process_response(
        self, request: HttpRequest, response: HttpResponseBase
    ) -> HttpResponseBase:
        with metrics.timer("middleware.ratelimit.process_response", sample_rate=0.01):
            try:
                rate_limit_metadata: RateLimitMeta | None = getattr(
                    request, "rate_limit_metadata", None
                )
                if rate_limit_metadata:
                    response["X-Sentry-Rate-Limit-Remaining"] = rate_limit_metadata.remaining
                    response["X-Sentry-Rate-Limit-Limit"] = rate_limit_metadata.limit
                    response["X-Sentry-Rate-Limit-Reset"] = rate_limit_metadata.reset_time
                    response["X-Sentry-Rate-Limit-ConcurrentRemaining"] = (
                        rate_limit_metadata.concurrent_remaining
                    )
                    response["X-Sentry-Rate-Limit-ConcurrentLimit"] = (
                        rate_limit_metadata.concurrent_limit
                    )
                if hasattr(request, "rate_limit_key") and hasattr(request, "rate_limit_uid"):
                    finish_request(request.rate_limit_key, request.rate_limit_uid)
            except Exception:
                logging.exception("COULD NOT POPULATE RATE LIMIT HEADERS")
            return response
