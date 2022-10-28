from __future__ import annotations

import datetime
import logging
from datetime import timedelta
from typing import Any, Literal, overload
from urllib.parse import urlparse

from django.utils import timezone
from rest_framework.request import Request

from sentry import options
from sentry.auth.access import get_cached_organization_member
from sentry.auth.superuser import is_active_superuser
from sentry.models import OrganizationMember
from sentry.models.organization import Organization
from sentry.search.utils import InvalidQuery, parse_datetime_string
from sentry.utils.dates import parse_stats_period

logger = logging.getLogger(__name__)

MAX_STATS_PERIOD = timedelta(days=90)


class InvalidParams(Exception):
    pass


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
    params: dict[str, Any],
    optional: Literal[False] = ...,
    default_stats_period: datetime.timedelta = ...,
) -> tuple[datetime.datetime, datetime.datetime]:
    ...


@overload
def get_date_range_from_params(
    params: dict[str, Any],
    optional: bool = ...,
    default_stats_period: datetime.timedelta = ...,
) -> tuple[None, None] | tuple[datetime.datetime, datetime.datetime]:
    ...


def get_date_range_from_params(
    params: dict[str, Any],
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
    timeframe = params.get("timeframe")
    timeframe_start = params.get("timeframeStart")
    timeframe_end = params.get("timeframeEnd")

    if timeframe is not None:
        params["statsPeriod"] = timeframe

    elif timeframe_start or timeframe_end:
        if not all([timeframe_start, timeframe_end]):
            raise InvalidParams("timeframeStart and timeframeEnd are both required")
        else:
            params["statsPeriodStart"] = timeframe_start
            params["statsPeriodEnd"] = timeframe_end

    return get_date_range_from_stats_period(
        params, optional=optional, default_stats_period=default_stats_period
    )


@overload
def get_date_range_from_stats_period(
    params: dict[str, Any],
    optional: Literal[False] = ...,
    default_stats_period: datetime.timedelta = ...,
) -> tuple[datetime.datetime, datetime.datetime]:
    ...


@overload
def get_date_range_from_stats_period(
    params: dict[str, Any],
    optional: bool = ...,
    default_stats_period: datetime.timedelta = ...,
) -> tuple[None, None] | tuple[datetime.datetime, datetime.datetime]:
    ...


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


def is_member_disabled_from_limit(request: Request, organization: Organization) -> bool:
    user = request.user

    # never limit sentry apps
    if getattr(user, "is_sentry_app", False):
        return False

    # don't limit super users
    if is_active_superuser(request):
        return False

    # must be a simple user at this point
    try:
        member = get_cached_organization_member(user.id, organization.id)
    except OrganizationMember.DoesNotExist:
        # if org member doesn't exist, we should be getting an auth error later
        return False
    else:
        return member.flags["member-limit:restricted"]  # type: ignore[no-any-return]


def generate_organization_hostname(org_slug: str) -> str:
    url_prefix_hostname: str = urlparse(options.get("system.url-prefix")).netloc
    org_base_hostname_template: str = options.get("system.organization-base-hostname")
    if not org_base_hostname_template:
        return url_prefix_hostname
    has_org_slug_placeholder = "{slug}" in org_base_hostname_template
    if not has_org_slug_placeholder:
        return url_prefix_hostname
    org_hostname = org_base_hostname_template.replace("{slug}", org_slug)
    return org_hostname


def generate_organization_url(org_slug: str) -> str:
    org_url_template: str = options.get("system.organization-url-template")
    if not org_url_template:
        return options.get("system.url-prefix")  # type: ignore[no-any-return]
    return org_url_template.replace("{hostname}", generate_organization_hostname(org_slug))


def generate_region_url() -> str:
    region_url_template: str = options.get("system.region-api-url-template")
    region = options.get("system.region") or None
    if not region_url_template or not region:
        return options.get("system.url-prefix")  # type: ignore[no-any-return]
    return region_url_template.replace("{region}", region)
