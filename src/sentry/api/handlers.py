from typing import int
import sentry_sdk
from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler

from sentry.types.ratelimit import SnubaRateLimitMeta
from sentry.utils.snuba import RateLimitExceeded


def custom_exception_handler(exc, context):
    if isinstance(exc, RateLimitExceeded):
        context_request = context.get("request")
        request = getattr(context_request, "_request", None)

        # Set rate limiting attributes on the underlying request object so access log middleware can log them
        if request is not None:
            request.will_be_rate_limited = True
            request.snuba_rate_limit_metadata = SnubaRateLimitMeta(
                policy=exc.policy,
                quota_unit=exc.quota_unit,
                storage_key=exc.storage_key,
                quota_used=exc.quota_used,
                rejection_threshold=exc.rejection_threshold,
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
