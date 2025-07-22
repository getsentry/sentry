import re

import sentry_sdk
from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler

from sentry.types.ratelimit import RateLimitMeta, RateLimitType
from sentry.utils.snuba import RateLimitExceeded


def custom_exception_handler(exc, context):
    if isinstance(exc, RateLimitExceeded):
        context_request = context.get("request")
        request = getattr(context_request, "_request", None)

        # Set rate limiting attributes on the underlying request object so access log middleware can log them
        if request is not None:
            request.will_be_rate_limited = True

            # Parse rate limit details from the error message
            remaining = None
            concurrent_limit = None
            concurrent_requests = None

            error_str = str(exc)
            try:
                quota_match = re.search(r"'quota_used': (\d+)", error_str)
                threshold_match = re.search(r"'rejection_threshold': (\d+)", error_str)

                if quota_match and threshold_match:
                    concurrent_requests = int(quota_match.group(1))
                    concurrent_limit = int(threshold_match.group(1))
                    remaining = max(0, concurrent_limit - concurrent_requests)
            except (ValueError, AttributeError):
                pass

            request.rate_limit_metadata = RateLimitMeta(
                rate_limit_type=RateLimitType.SNUBA,
                current=None,
                remaining=remaining,
                limit=None,
                window=None,
                group="snuba",
                reset_time=None,
                concurrent_limit=concurrent_limit,
                concurrent_requests=concurrent_requests,
            )

        # capture the rate limited exception so we can see it in Sentry
        with sentry_sdk.new_scope() as scope:
            scope.fingerprint = ["snuba-api-rate-limit-exceeded"]
            sentry_sdk.capture_exception(
                exc,
                level="warning",
            )
        # let the client know that they've been rate limited with details
        exc = Throttled(
            detail="Rate limit exceeded. Please try your query with a smaller date range or fewer projects."
        )

    return exception_handler(exc, context)
