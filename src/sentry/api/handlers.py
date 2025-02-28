import sentry_sdk
from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler

from sentry.utils.snuba import RateLimitExceeded


def custom_exception_handler(exc, context):
    if isinstance(exc, RateLimitExceeded):
        # capture the rate limited exception so we can see it in Sentry
        sentry_sdk.capture_exception(
            exc,
            fingerprint=["snuba-api-rate-limit-exceeded"],
            level="warning",
        )
        # let the client know that they've been rate limited with details
        exc = Throttled(detail=str(exc))

    return exception_handler(exc, context)
