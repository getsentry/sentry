import logging
from typing import NotRequired, TypedDict

import sentry_sdk
from django.conf import settings
from urllib3 import Retry

from sentry.net.http import connection_from_url
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

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


seer_connection_pool = connection_from_url(
    settings.ANOMALY_DETECTION_URL,
    retries=Retry(
        total=5,
        status_forcelist=[408, 429, 502, 503, 504],
    ),
    timeout=settings.ANOMALY_DETECTION_TIMEOUT,
)

seer_staging_connection_pool = connection_from_url(
    settings.SEER_AUTOFIX_URL,
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

    if response.status >= 200 and response.status < 300:
        try:
            return json.loads(response.data)
        except ValueError as e:
            # seer failed to return valid json, report the error
            # and assume no breakpoints were found
            sentry_sdk.capture_exception(e)
            return {"data": []}

    with sentry_sdk.push_scope() as scope:
        scope.set_context(
            "seer_response",
            {
                "data": response.data,
            },
        )
        sentry_sdk.capture_exception(SeerException(f"Seer response: {response.status}"))

    # assume no breakpoints if an error was returned from seer
    return {"data": []}


class SimilarIssuesEmbeddingsRequest(TypedDict):
    group_id: int
    project_id: int
    stacktrace: str
    message: str
    k: NotRequired[int]  # how many neighbors to find
    threshold: NotRequired[float]


class SimilarIssuesEmbeddingsData(TypedDict):
    parent_group_id: int
    stacktrace_distance: float
    message_distance: float
    should_group: bool


class SimilarIssuesEmbeddingsResponse(TypedDict):
    responses: list[SimilarIssuesEmbeddingsData]


def get_similar_issues_embeddings(
    similar_issues_request: SimilarIssuesEmbeddingsRequest,
) -> SimilarIssuesEmbeddingsResponse:
    """Call /v0/issues/similar-issues endpoint from seer."""
    response = seer_staging_connection_pool.urlopen(
        "POST",
        "/v0/issues/similar-issues",
        body=json.dumps(similar_issues_request),
        headers={"Content-Type": "application/json;charset=utf-8"},
    )

    try:
        return json.loads(response.data.decode("utf-8"))
    except (
        AttributeError,  # caused by a response with no data and therefore no `.decode` method
        UnicodeError,
        JSONDecodeError,
    ):
        logger.exception(
            "Failed to parse seer similar issues response",
            extra={
                "request_params": similar_issues_request,
                "response_data": response.data,
            },
        )
        return {"responses": []}
