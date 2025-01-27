from __future__ import annotations

import datetime
import logging
import sys
import traceback
from collections.abc import Generator, Mapping
from contextlib import contextmanager
from datetime import timedelta
from typing import Any, Literal, overload

import sentry_sdk
from django.conf import settings
from django.http import HttpRequest
from django.utils import timezone
from rest_framework.exceptions import APIException, ParseError
from rest_framework.request import Request
from sentry_sdk import Scope
from urllib3.exceptions import MaxRetryError, ReadTimeoutError, TimeoutError

from sentry import options
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.discover.arithmetic import ArithmeticError
from sentry.exceptions import IncompatibleMetricsQuery, InvalidParams, InvalidSearchQuery
from sentry.hybridcloud.rpc import extract_id_from
from sentry.models.apikey import is_api_key_auth
from sentry.models.apitoken import is_api_token_auth
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import is_org_auth_token_auth
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.search.events.constants import TIMEOUT_ERROR_MESSAGE, TIMEOUT_RPC_ERROR_MESSAGE
from sentry.search.events.types import SnubaParams
from sentry.search.utils import InvalidQuery, parse_datetime_string
from sentry.silo.base import SiloMode
from sentry.types.region import get_local_region
from sentry.utils.dates import parse_stats_period
from sentry.utils.sdk import capture_exception, merge_context_into_scope
from sentry.utils.snuba import (
    DatasetSelectionError,
    QueryConnectionFailed,
    QueryExecutionError,
    QueryExecutionTimeMaximum,
    QueryIllegalTypeOfArgument,
    QueryMemoryLimitExceeded,
    QueryMissingColumn,
    QueryOutsideRetentionError,
    QuerySizeExceeded,
    QueryTooManySimultaneous,
    RateLimitExceeded,
    SchemaValidationError,
    SnubaError,
    UnqualifiedQueryError,
)
from sentry.utils.snuba_rpc import SnubaRPCError

logger = logging.getLogger(__name__)

MAX_STATS_PERIOD = timedelta(days=90)


def get_datetime_from_stats_period(
    stats_period: str, now: datetime.datetime | None = None
) -> datetime.datetime:
    if now is None:
        now = timezone.now()
    parsed_stats_period = parse_stats_period(stats_period)
    if parsed_stats_period is None:
        raise InvalidParams(f"Invalid statsPeriod: {stats_period!r}")
    try:
        return now - parsed_stats_period
    except OverflowError:
        raise InvalidParams(f"Invalid statsPeriod: {stats_period!r}")


def default_start_end_dates(
    now: datetime.datetime | None = None,
    default_stats_period: datetime.timedelta = MAX_STATS_PERIOD,
) -> tuple[datetime.datetime, datetime.datetime]:
    if now is None:
        now = timezone.now()
    return now - default_stats_period, now


@overload
def get_date_range_from_params(
    params: Mapping[str, Any],
    optional: Literal[False] = ...,
    default_stats_period: datetime.timedelta = ...,
) -> tuple[datetime.datetime, datetime.datetime]: ...


@overload
def get_date_range_from_params(
    params: Mapping[str, Any],
    optional: bool = ...,
    default_stats_period: datetime.timedelta = ...,
) -> tuple[None, None] | tuple[datetime.datetime, datetime.datetime]: ...


def get_date_range_from_params(
    params: Mapping[str, Any],
    optional: bool = False,
    default_stats_period: datetime.timedelta = MAX_STATS_PERIOD,
) -> tuple[None, None] | tuple[datetime.datetime, datetime.datetime]:
    """
    A wrapper function for `get_date_range_from_stats_period` that allows us
    to alias `statsPeriod` to ensure backward compatibility.

    If `timeframe` is passed then convert to a time delta and make sure it
    fits within our min/max period length. Values are in the format
    <number><period_type>, where period type is one of `s` (seconds),
    `m` (minutes), `h` (hours) or `d` (days).

    Similarly, `timeframeStart` and `timeframeEnd` allow for selecting a
    relative range, for example: 15 days ago through 8 days ago. This uses the same
    format as `statsPeriod`.

    :param params:
    If `start` end `end` are passed, validate them, convert to `datetime` and
    returns them if valid.
    :param optional: When True, if no params passed then return `(None, None)`.
    :param default_stats_period: When set, this becomes the interval upon which default start
    and end dates are defined
    :return: A length 2 tuple containing start/end or raises an `InvalidParams`
    exception
    """
    mutable_params = {
        k: params[k]
        for k in (
            *("timeframe", "timeframeStart", "timeframeEnd"),
            *("statsPeriod", "statsPeriodStart", "statsPeriodEnd"),
            *("start", "end"),
        )
        if k in params
    }
    timeframe = mutable_params.get("timeframe")
    timeframe_start = mutable_params.get("timeframeStart")
    timeframe_end = mutable_params.get("timeframeEnd")

    if timeframe is not None:
        mutable_params["statsPeriod"] = timeframe

    elif timeframe_start or timeframe_end:
        if not all([timeframe_start, timeframe_end]):
            raise InvalidParams("timeframeStart and timeframeEnd are both required")
        else:
            mutable_params["statsPeriodStart"] = timeframe_start
            mutable_params["statsPeriodEnd"] = timeframe_end

    return get_date_range_from_stats_period(
        mutable_params, optional=optional, default_stats_period=default_stats_period
    )


@overload
def get_date_range_from_stats_period(
    params: dict[str, Any],
    optional: Literal[False] = ...,
    default_stats_period: datetime.timedelta = ...,
) -> tuple[datetime.datetime, datetime.datetime]: ...


@overload
def get_date_range_from_stats_period(
    params: dict[str, Any],
    optional: bool = ...,
    default_stats_period: datetime.timedelta = ...,
) -> tuple[None, None] | tuple[datetime.datetime, datetime.datetime]: ...


def get_date_range_from_stats_period(
    params: dict[str, Any],
    optional: bool = False,
    default_stats_period: datetime.timedelta = MAX_STATS_PERIOD,
) -> tuple[None, None] | tuple[datetime.datetime, datetime.datetime]:
    """
    Gets a date range from standard date range params we pass to the api.

    If `statsPeriod` is passed then convert to a time delta and make sure it
    fits within our min/max period length. Values are in the format
    <number><period_type>, where period type is one of `s` (seconds),
    `m` (minutes), `h` (hours) or `d` (days).

    Similarly, `statsPeriodStart` and `statsPeriodEnd` allow for selecting a
    relative range, for example: 15 days ago through 8 days ago. This uses the same
    format as `statsPeriod`

    :param params:
    If `start` end `end` are passed, validate them, convert to `datetime` and
    returns them if valid.
    :param optional: When True, if no params passed then return `(None, None)`.
    :param default_stats_period: When set, this becomes the interval upon which default start
    and end dates are defined
    :return: A length 2 tuple containing start/end or raises an `InvalidParams`
    exception
    """
    now = timezone.now()

    start, end = default_start_end_dates(now, default_stats_period)

    stats_period = params.get("statsPeriod")
    stats_period_start = params.get("statsPeriodStart")
    stats_period_end = params.get("statsPeriodEnd")

    if stats_period is not None:
        start = get_datetime_from_stats_period(stats_period, now)

    elif stats_period_start or stats_period_end:
        if not stats_period_start or not stats_period_end:
            raise InvalidParams("statsPeriodStart and statsPeriodEnd are both required")
        start = get_datetime_from_stats_period(stats_period_start, now)
        end = get_datetime_from_stats_period(stats_period_end, now)

    elif params.get("start") or params.get("end"):
        if not all([params.get("start"), params.get("end")]):
            raise InvalidParams("start and end are both required")
        try:
            start = parse_datetime_string(params["start"])
            end = parse_datetime_string(params["end"])
        except InvalidQuery as e:
            raise InvalidParams(str(e))
    elif optional:
        return None, None

    if start >= end:
        raise InvalidParams("start must be before end")

    return start, end


def clamp_date_range(
    range: tuple[datetime.datetime, datetime.datetime], max_timedelta: datetime.timedelta
) -> tuple[datetime.datetime, datetime.datetime]:
    """
    Accepts a date range and a maximum time delta. If the date range is shorter
    than the max delta, returns the range as-is. If the date range is longer than the max delta, clamps the range range, anchoring to the end.

    If any of the inputs are invalid (e.g., a negative range) returns the range
    without modifying it.

    :param range: A tuple of two `datetime.datetime` objects
    :param max_timedelta: Maximum allowed range delta
    :return: A tuple of two `datetime.datetime` objects
    """

    [start, end] = range
    delta = end - start

    # Ignore negative max time deltas
    if max_timedelta < datetime.timedelta(0):
        return (start, end)

    # Ignore if delta is within acceptable range
    if delta < max_timedelta:
        return (start, end)

    return (end - max_timedelta, end)


# The wide typing allows us to move towards RpcUserOrganizationContext in the future to save RPC calls.
# If you can use the wider more correct type, please do.
def is_member_disabled_from_limit(
    request: Request,
    organization: RpcUserOrganizationContext | RpcOrganization | Organization | int,
) -> bool:
    user = request.user

    # never limit sentry apps
    if getattr(user, "is_sentry_app", False):
        return False

    # don't limit superuser or staff
    if is_active_superuser(request) or is_active_staff(request):
        return False

    # must be a simple user at this point

    member: RpcOrganizationMember | None
    if isinstance(organization, RpcUserOrganizationContext):
        member = organization.member
    else:
        member = organization_service.check_membership_by_id(
            organization_id=extract_id_from(organization), user_id=user.id
        )
    if member is None:
        return False
    else:
        return member.flags.member_limit__restricted


def generate_region_url(region_name: str | None = None) -> str:
    region_url_template: str | None = options.get("system.region-api-url-template")
    if region_name is None and SiloMode.get_current_mode() == SiloMode.REGION:
        region_name = get_local_region().name
    if (
        region_name is None
        and SiloMode.get_current_mode() == SiloMode.MONOLITH
        and settings.SENTRY_REGION
    ):
        region_name = settings.SENTRY_REGION
    if not region_url_template or not region_name:
        return options.get("system.url-prefix")
    return region_url_template.replace("{region}", region_name)


def print_and_capture_handler_exception(
    exception: Exception,
    handler_context: Mapping[str, Any] | None = None,
    scope: Scope | None = None,
) -> str | None:
    """
    Logs the given exception locally, then sends it to Sentry, along with the given context data.
    Returns the id of the captured event.
    """

    sys.stderr.write(traceback.format_exc())

    scope = scope or Scope()
    if handler_context:
        merge_context_into_scope("Request Handler Data", handler_context, scope)
    event_id: str | None = capture_exception(exception, scope=scope)

    return event_id


def get_auth_api_token_type(auth: object) -> str | None:
    if is_api_token_auth(auth):
        return "api_token"
    if is_org_auth_token_auth(auth):
        return "org_auth_token"
    if is_api_key_auth(auth):
        return "api_key"
    return None


@contextmanager
def handle_query_errors() -> Generator[None]:
    try:
        yield
    except InvalidSearchQuery as error:
        message = str(error)
        # Special case the project message since it has so many variants so tagging is messy otherwise
        if message.endswith("do not exist or are not actively selected."):
            sentry_sdk.set_tag(
                "query.error_reason", "Project in query does not exist or not selected"
            )
        else:
            sentry_sdk.set_tag("query.error_reason", message)
        raise ParseError(detail=message)
    except ArithmeticError as error:
        message = str(error)
        sentry_sdk.set_tag("query.error_reason", message)
        raise ParseError(detail=message)
    except QueryOutsideRetentionError as error:
        sentry_sdk.set_tag("query.error_reason", "QueryOutsideRetentionError")
        raise ParseError(detail=str(error))
    except QueryIllegalTypeOfArgument:
        message = "Invalid query. Argument to function is wrong type."
        sentry_sdk.set_tag("query.error_reason", message)
        raise ParseError(detail=message)
    except IncompatibleMetricsQuery as error:
        message = str(error)
        sentry_sdk.set_tag("query.error_reason", f"Metric Error: {message}")
        raise ParseError(detail=message)
    except SnubaRPCError as error:
        message = "Internal error. Please try again."
        arg = error.args[0] if len(error.args) > 0 else None
        if isinstance(arg, TimeoutError):
            sentry_sdk.set_tag("query.error_reason", "Timeout")
            raise ParseError(detail=TIMEOUT_RPC_ERROR_MESSAGE)
        raise APIException(detail=message)
    except SnubaError as error:
        message = "Internal error. Please try again."
        arg = error.args[0] if len(error.args) > 0 else None
        if isinstance(
            error,
            (
                RateLimitExceeded,
                QueryMemoryLimitExceeded,
                QueryExecutionTimeMaximum,
                QueryTooManySimultaneous,
            ),
        ) or isinstance(
            arg,
            ReadTimeoutError,
        ):
            sentry_sdk.set_tag("query.error_reason", "Timeout")
            raise ParseError(detail=TIMEOUT_ERROR_MESSAGE)
        elif isinstance(error, (UnqualifiedQueryError)):
            sentry_sdk.set_tag("query.error_reason", str(error))
            raise ParseError(detail=str(error))
        elif isinstance(
            error,
            (
                DatasetSelectionError,
                QueryConnectionFailed,
                QueryExecutionError,
                QuerySizeExceeded,
                SchemaValidationError,
                QueryMissingColumn,
            ),
        ):
            sentry_sdk.capture_exception(error)
            message = "Internal error. Your query failed to run."
        elif isinstance(
            arg,
            (MaxRetryError),
        ):
            sentry_sdk.capture_message(str(error), level="warning")
            message = "Internal error. Your query failed to run. This may be temporary please try again later."
        else:
            sentry_sdk.capture_exception(error)
        raise APIException(detail=message)


def update_snuba_params_with_timestamp(
    request: HttpRequest,
    params: SnubaParams,
    timestamp_key: str = "timestamp",
) -> None:
    """In some views we only want to query snuba data around a single event or trace. In these cases the frontend can
    send the timestamp of something in that event or trace and we'll query data near that event only which should be
    faster than the default 7d or 14d queries"""
    # during the transition this is optional but it will become required for the trace view
    sentry_sdk.set_tag("trace_view.used_timestamp", timestamp_key in request.GET)
    has_dates = params.start is not None and params.end is not None
    if timestamp_key in request.GET and has_dates:
        example_timestamp = parse_datetime_string(request.GET[timestamp_key])
        # While possible, the majority of traces shouldn't take more than a week
        # Starting with 3d for now, but potentially something we can increase if this becomes a problem
        time_buffer = options.get("performance.traces.transaction_query_timebuffer_days")
        sentry_sdk.set_measurement("trace_view.transactions.time_buffer", time_buffer)
        example_start = example_timestamp - timedelta(days=time_buffer)
        example_end = example_timestamp + timedelta(days=time_buffer)
        # If timestamp is being passed it should always overwrite the statsperiod or start & end
        # the client should just not pass a timestamp if we need to overwrite this logic for any reason

        params.start = max(params.start_date, example_start)
        params.end = min(params.end_date, example_end)
