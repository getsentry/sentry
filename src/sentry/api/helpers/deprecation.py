from __future__ import annotations

import functools
from datetime import datetime, timedelta, timezone

from croniter import croniter
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_410_GONE as GONE

from sentry.utils.settings import is_self_hosted

BROWNOUT_LENGTH = timedelta(days=30)
GONE_MESSAGE = {"message": "This API no longer exists."}
DEPRECATION_HEADER = "X-Sentry-Deprecation-Date"
SUGGESTED_API_HEADER = "X-Sentry-Replacement-Endpoint"

# TODO: Make these configurable from redis
BROWNOUT_CRON = "0 12 * * *"
BROWNOUT_DURATION = timedelta(minutes=1)


def _track_deprecated_metrics(request: Request, deprecation_date: datetime):
    # TODO: Better way to track requests on deprecated endpoints
    # indicate the request is on a deprecated endpoint
    request.is_deprecated = True
    request.deprecation_date = deprecation_date


def _should_be_blocked(deprecation_date: datetime, now: datetime):
    # Will need to check redis if the hour fits into the brownout period
    if now >= deprecation_date:

        # return True if now exactly matches the crontab
        if croniter.match(BROWNOUT_CRON, now):
            return True

        # If not, check if now is within BROWNOUT_DURATION of the last brownout time
        iter = croniter(BROWNOUT_CRON, now)
        brownout_start = iter.get_prev(datetime)
        return brownout_start <= now < brownout_start + BROWNOUT_DURATION
    return False


def _add_deprecation_headers(
    response: Response, deprecation_date: datetime, suggested_api: str | None = None
):
    response[DEPRECATION_HEADER] = deprecation_date.isoformat()
    if suggested_api is not None:
        response[SUGGESTED_API_HEADER] = suggested_api


def deprecated(deprecation_date: datetime, suggested_api: str | None = None):
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

    def decorator(func):
        @functools.wraps(func)
        def endpoint_method(self, request: Request, *args, **kwargs):

            # Don't do anything for deprecated endpoints on self hosted
            if is_self_hosted():
                return func(self, request, *args, **kwargs)

            now = datetime.now(timezone.utc)
            # TODO: Need a better way to flag a request on a deprecated endpoint
            # _track_deprecated_metrics(request, deprecation_date)

            if now > deprecation_date and _should_be_blocked(deprecation_date, now):
                response = Response(GONE_MESSAGE, status=GONE)
            else:
                response = func(self, request, *args, **kwargs)

            _add_deprecation_headers(response, deprecation_date, suggested_api)

            return response

        return endpoint_method

    return decorator
