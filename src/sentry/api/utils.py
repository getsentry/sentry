from __future__ import annotations

import datetime
import logging
import re
import sys
import traceback
from datetime import timedelta
from typing import Any, List, Literal, Mapping, Tuple, overload
from urllib.parse import urlparse

from django.conf import settings
from django.http import HttpResponseNotAllowed
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from sentry_sdk import Scope

from sentry import options
from sentry.auth.superuser import is_active_superuser
from sentry.exceptions import InvalidParams
from sentry.models.apikey import is_api_key_auth
from sentry.models.apitoken import is_api_token_auth
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import is_org_auth_token_auth
from sentry.search.utils import InvalidQuery, parse_datetime_string
from sentry.services.hybrid_cloud import extract_id_from
from sentry.services.hybrid_cloud.organization import (
    RpcOrganization,
    RpcOrganizationMember,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.utils.dates import parse_stats_period
from sentry.utils.sdk import capture_exception, merge_context_into_scope

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
    mutable_params = params.copy()
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

    # don't limit super users
    if is_active_superuser(request):
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
        return options.get("system.url-prefix")
    return org_url_template.replace("{hostname}", generate_organization_hostname(org_slug))


def generate_region_url(region_name: str | None = None) -> str:
    region_url_template: str | None = options.get("system.region-api-url-template")
    if region_name is None:
        region_name = settings.SENTRY_REGION
    if not region_url_template or not region_name:
        return options.get("system.url-prefix")
    return region_url_template.replace("{region}", region_name)


_path_patterns: List[Tuple[re.Pattern[str], str]] = [
    # /organizations/slug/section, but not /organizations/new
    (re.compile(r"\/?organizations\/(?!new)[^\/]+\/(.*)"), r"/\1"),
    # For /settings/:orgId/ -> /settings/organization/
    (
        re.compile(r"\/settings\/(?!account)(?!billing)(?!projects)(?!teams)[^\/]+\/?$"),
        "/settings/organization/",
    ),
    # Move /settings/:orgId/:section -> /settings/:section
    # but not /settings/organization or /settings/projects which is a new URL
    (
        re.compile(r"^\/?settings\/(?!account)(?!billing)(?!projects)(?!teams)[^\/]+\/(.*)"),
        r"/settings/\1",
    ),
    (re.compile(r"^\/?join-request\/[^\/]+\/?.*"), r"/join-request/"),
    (re.compile(r"^\/?onboarding\/[^\/]+\/(.*)"), r"/onboarding/\1"),
    (
        re.compile(r"^\/?(?!settings)[^\/]+\/([^\/]+)\/getting-started\/(.*)"),
        r"/getting-started/\1/\2",
    ),
]


def customer_domain_path(path: str) -> str:
    """
    Server side companion to path normalizations found in withDomainRequired
    """
    for pattern, replacement in _path_patterns:
        updated = pattern.sub(replacement, path)
        if updated != path:
            return updated
    return path


def method_dispatch(**dispatch_mapping):
    """
    Dispatches a incoming request to a different handler based on the HTTP method

    >>> re_path('^foo$', method_dispatch(POST = post_handler, GET = get_handler)))
    """

    def invalid_method(request, *args, **kwargs):
        return HttpResponseNotAllowed(dispatch_mapping.keys())

    def dispatcher(request, *args, **kwargs):
        handler = dispatch_mapping.get(request.method, invalid_method)
        return handler(request, *args, **kwargs)

    if dispatch_mapping.get("csrf_exempt"):
        return csrf_exempt(dispatcher)

    return dispatcher


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
