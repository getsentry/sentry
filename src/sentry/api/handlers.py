from rest_framework.exceptions import Throttled
from rest_framework.views import exception_handler

from sentry.utils.snuba import RateLimitExceeded


def custom_exception_handler(exc, context):
    if isinstance(exc, RateLimitExceeded):
        # If Snuba throws a RateLimitExceeded then it'll likely be available
        # after another second.
        exc = Throttled(wait=1)

    return exception_handler(exc, context)
