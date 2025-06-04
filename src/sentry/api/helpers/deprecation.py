from __future__ import annotations

import functools
import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Concatenate, ParamSpec, TypeVar

import isodate
from cronsim import CronSim, CronSimError
from django.conf import settings
from django.http.response import HttpResponseBase
from django.utils import timezone
from isodate.isoerror import ISO8601Error
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.status import HTTP_410_GONE as GONE

from sentry import options
from sentry.options import UnknownOption
from sentry.utils.settings import is_self_hosted

GONE_MESSAGE = {"message": "This API no longer exists."}
DEPRECATION_HEADER = "X-Sentry-Deprecation-Date"
SUGGESTED_API_HEADER = "X-Sentry-Replacement-Endpoint"


logger = logging.getLogger(__name__)


def _serialize_key(key: str) -> tuple[str, str]:
    """Converts the key into an option manager key used for the schedule crontab and blackout duration"""
    return f"{key}-cron", f"{key}-duration"


def _should_be_blocked(deprecation_date: datetime, now: datetime, key: str) -> bool:
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

        try:
            # Move back one minute so we can iterate once and determine if now
            # matches the cron schedule.
            iter = CronSim(brownout_cron, now - timedelta(minutes=1))
        except CronSimError:
            logger.exception("Invalid crontab for blackout schedule")
            return False

        if next(iter) == now.replace(second=0, microsecond=0):
            return True

        # If not, check if now is within `brownout_duration` of the last brownout time
        brownout_start = next(CronSim(brownout_cron, now, reverse=True))
        return brownout_start <= now < brownout_start + brownout_duration
    return False


def _add_deprecation_headers(
    response: HttpResponseBase, deprecation_date: datetime, suggested_api: str | None = None
) -> None:
    response[DEPRECATION_HEADER] = deprecation_date.isoformat()
    if suggested_api is not None:
        response[SUGGESTED_API_HEADER] = suggested_api


SelfT = TypeVar("SelfT")
P = ParamSpec("P")
EndpointT = Callable[Concatenate[SelfT, Request, P], HttpResponseBase]


def deprecated(
    deprecation_date: datetime,
    suggested_api: str | None = None,
    key: str = "",
) -> Callable[[EndpointT[SelfT, P]], EndpointT[SelfT, P]]:
    """
    Deprecation decorator that handles all the overhead related to deprecated endpoints

    Usage example:
    @deprecated(datetime.fromisoformat("2022-01-02T00:00:00Z")
    def get(self, request):

    This decorator does 3 things:
    1) Add additional metrics to be tracked for deprecated endpoints;
    2) Add headers indicating deprecation date to requests on deprecated endpoints;
    3) Start brownouts after the deprectation date, which reject requests if they
       fall within a brownout's blackout window defined by a cron schedule and duration.

    This decorator will do nothing if the environment is self-hosted and not set to 'development'.

    :param deprecation_date: The date at which the endpoint is starts brownouts;
    :param suggested_api: The suggested API to use instead of the deprecated one;
    :param key: The key prefix for an option use for the brownout schedule and duration
                If not set 'api.deprecation.brownout' will be used, which currently
                is using schedule of a 1 minute blackout at noon UTC.
    """

    def decorator(func: EndpointT[SelfT, P]) -> EndpointT[SelfT, P]:
        @functools.wraps(func)
        def endpoint_method(
            self: SelfT, request: Request, *args: P.args, **kwargs: P.kwargs
        ) -> HttpResponseBase:
            # Don't do anything for deprecated endpoints on self hosted
            # but allow testing deprecation in development
            if is_self_hosted() and not settings.ENVIRONMENT == "development":
                return func(self, request, *args, **kwargs)

            now = timezone.now()

            if now > deprecation_date and _should_be_blocked(deprecation_date, now, key):
                response: HttpResponseBase = Response(GONE_MESSAGE, status=GONE)
            else:
                response = func(self, request, *args, **kwargs)

            _add_deprecation_headers(response, deprecation_date, suggested_api)

            return response

        return endpoint_method

    return decorator
