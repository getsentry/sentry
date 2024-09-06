import logging
from collections.abc import Mapping
from typing import NotRequired, TypedDict

import sentry_sdk
from django.conf import settings
from urllib3 import Retry

from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json

logger = logging.getLogger(__name__)


class SeerException(Exception):
    pass


class BreakpointData(TypedDict):
    project: str
    # For legacy reasons, the group name is always
    # transaction even when working with functions.
    transaction: str
    aggregate_range_1: float
    aggregate_range_2: float
    unweighted_t_value: float
    unweighted_p_value: float
    trend_percentage: float
    absolute_percentage_change: float
    trend_difference: float
    breakpoint: int


class BreakpointResponse(TypedDict):
    data: list[BreakpointData]


seer_breakpoint_connection_pool = connection_from_url(
    settings.SEER_BREAKPOINT_DETECTION_URL,
    retries=Retry(
        total=5,
        status_forcelist=[408, 429, 502, 503, 504],
    ),
    timeout=settings.SEER_BREAKPOINT_DETECTION_TIMEOUT,
)


# TODO: Source these from shared schema repository
class BreakpointRequest(TypedDict):
    data: "Mapping[str, BreakpointTransaction]"
    sort: NotRequired[str]
    allow_midpoint: NotRequired[str]
    validate_tail_hours: NotRequired[int]
    trend_percentage: NotRequired[float]
    min_change: NotRequired[float]


class BreakpointTransaction(TypedDict):
    data: "list[SnubaTSEntry]"
    request_start: int
    request_end: int
    data_start: int
    data_end: int


class SnubaMetadata(TypedDict):
    count: float


SnubaTSEntry = tuple[int, tuple[SnubaMetadata]]


def detect_breakpoints(breakpoint_request: BreakpointRequest) -> BreakpointResponse:
    response = make_signed_seer_api_request(
        seer_breakpoint_connection_pool,
        "/trends/breakpoint-detector",
        json.dumps(breakpoint_request).encode("utf-8"),
    )

    if response.status >= 200 and response.status < 300:
        try:
            return json.loads(response.data)
        except ValueError as e:
            # seer failed to return valid json, report the error
            # and assume no breakpoints were found
            sentry_sdk.capture_exception(e)
            return {"data": []}

    with sentry_sdk.isolation_scope() as scope:
        scope.set_context(
            "seer_response",
            {
                "data": response.data,
            },
        )
        sentry_sdk.capture_exception(SeerException(f"Seer response: {response.status}"))

    # assume no breakpoints if an error was returned from seer
    return {"data": []}
