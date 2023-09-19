from typing import List, TypedDict

from django.conf import settings
from urllib3 import Retry

from sentry.net.http import connection_from_url
from sentry.utils import json


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
    data: List[BreakpointData]


seer_connection_pool = connection_from_url(
    settings.ANOMALY_DETECTION_URL,
    retries=Retry(
        total=5,
        status_forcelist=[408, 429, 502, 503, 504],
    ),
    timeout=settings.ANOMALY_DETECTION_TIMEOUT,
)


def detect_breakpoints(breakpoint_request) -> BreakpointResponse:
    response = seer_connection_pool.urlopen(
        "POST",
        "/trends/breakpoint-detector",
        body=json.dumps(breakpoint_request),
        headers={"content-type": "application/json;charset=utf-8"},
    )
    return json.loads(response.data)
