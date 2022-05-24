import functools
from datetime import datetime, timedelta

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_410_GONE as GONE

BROWNOUT_LENGTH = timedelta(days=30)
GONE_MESSAGE = {"message": "This API no longer exists."}
DEPRECATION_HEADER = "X-Sentry-Deprecation-Date"


def _track_deprecated_metrics(request: Request, deprecation_date: datetime, now: datetime):
    # indicate the request is on a deprecated endpoint
    request.is_deprecated = deprecation_date >= now
    request.deprecation_date = deprecation_date


def _should_be_blocked(deprecation_date: datetime, now: datetime):
    # Placeholder logic
    # Will need to check redis if the hour fits into the brownout period
    return now >= deprecation_date


def _add_deprecation_headers(response: Response, deprecation_date: datetime):
    response[DEPRECATION_HEADER] = deprecation_date.isoformat()


def deprecated(deprecation_date: datetime):
    """
    Deprecation decorator that handles all the overhead related to deprecated endpoints

    Usage example:
    @deprecated(datetime.fromisoformat("2022-01-02T00:00:00Z")
    def get(self, request):

    This decorator does 3 things:
    1) Add additional metrics to be tracked for deprecated endpoints
    2) Add headers indicating deprecation date to requests on deprecated endpoints
    3) Reject requests if they fall within a brownout window
    """

    now = datetime.utcnow()

    def decorator(func):
        @functools.wraps(func)
        def endpoint_method(self, request: Request, *args, **kwargs):

            _track_deprecated_metrics(request, deprecation_date, now)

            if now > deprecation_date and _should_be_blocked(deprecation_date, now):
                response = Response(GONE_MESSAGE, status=GONE)
            else:
                response = func(self, request, *args, **kwargs)

            _add_deprecation_headers(response, deprecation_date)

            return response

        return endpoint_method

    return decorator
