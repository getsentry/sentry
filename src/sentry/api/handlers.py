import sentry_sdk
from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler

from sentry.utils.snuba import RateLimitExceeded


def custom_exception_handler(exc, context):
    if isinstance(exc, RateLimitExceeded):
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
