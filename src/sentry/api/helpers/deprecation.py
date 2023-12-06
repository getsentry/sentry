from __future__ import annotations

import functools
import logging
from datetime import datetime, timedelta, timezone
from typing import Tuple

import isodate
from croniter import croniter
from isodate.isoerror import ISO8601Error
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_410_GONE as GONE

from sentry import options
from sentry.options import UnknownOption
from sentry.utils.settings import is_self_hosted

BROWNOUT_LENGTH = timedelta(days=30)
GONE_MESSAGE = {"message": "This API no longer exists."}
DEPRECATION_HEADER = "X-Sentry-Deprecation-Date"
SUGGESTED_API_HEADER = "X-Sentry-Replacement-Endpoint"


logger = logging.getLogger(__name__)


def _track_deprecated_metrics(request: Request, deprecation_date: datetime):
    # TODO: Better way to track requests on deprecated endpoints
    # indicate the request is on a deprecated endpoint
    request.is_deprecated = True
    request.deprecation_date = deprecation_date


def _serialize_key(key: str) -> Tuple[str, str]:
    """Converts the key into an option manager key used for the schedule crontab and blackout duration"""
    return f"{key}-cron", f"{key}-duration"


def _should_be_blocked(deprecation_date: datetime, now: datetime, key: str):
    """
    Determines if a request should be blocked given the current date time and a schedule

    For example if the schedule blocks requests at noon for 1 minute, then a request coming in at
    11:59:59 would be allowed while one at 12:00:01 would not
    """
    # Will need to check redis if the hour fits into the brownout period
    if now >= deprecation_date:
        key = "api.deprecation.brownout" if not key else key

        # Retrieve any custom schedule saved
        # Fall back on the default schedule if there's any issue getting a custom one
        cron_key, duration_key = _serialize_key(key)
        try:
            brownout_cron = options.get(cron_key)
        except UnknownOption:
            logger.exception("Unrecognized deprecation key %s", key)
            brownout_cron = options.get("api.deprecation.brownout-cron")

        try:
            brownout_duration = options.get(duration_key)
        except UnknownOption:
            logger.exception("Unrecognized deprecation duration %s", key)
            brownout_duration = options.get("api.deprecation.brownout-duration")

        # Validate the formats, allow requests to pass through if validation failed
        try:
            brownout_duration = isodate.parse_duration(brownout_duration)
        except ISO8601Error:
            logger.exception("Invalid ISO8601 format for blackout duration")
            return False

        if not croniter.is_valid(brownout_cron):
            logger.error("Invalid crontab for blackout schedule")
            return False

        # return True if now exactly matches the crontab
        if croniter.match(brownout_cron, now):
            return True

        # If not, check if now is within BROWNOUT_DURATION of the last brownout time
        iter = croniter(brownout_cron, now)
        brownout_start = iter.get_prev(datetime)
        return brownout_start <= now < brownout_start + brownout_duration
    return False


def _add_deprecation_headers(
    response: Response, deprecation_date: datetime, suggested_api: str | None = None
):
    response[DEPRECATION_HEADER] = deprecation_date.isoformat()
    if suggested_api is not None:
        response[SUGGESTED_API_HEADER] = suggested_api


def deprecated(
    deprecation_date: datetime,
    suggested_api: str | None = None,
    key: str = "",
):
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

            if now > deprecation_date and _should_be_blocked(deprecation_date, now, key):
                response = Response(GONE_MESSAGE, status=GONE)
            else:
                response = func(self, request, *args, **kwargs)

            _add_deprecation_headers(response, deprecation_date, suggested_api)

            return response

        return endpoint_method

    return decorator
