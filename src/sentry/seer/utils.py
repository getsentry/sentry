from typing import TypedDict

import sentry_sdk
from django.conf import settings
from urllib3 import Retry

from sentry.net.http import connection_from_url
from sentry.utils import json


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


class SimilarIssuesEmbeddingsRequestNotRequired(TypedDict, total=False):
    k: int
    threshold: float


class SimilarIssuesEmbeddingsRequest(SimilarIssuesEmbeddingsRequestNotRequired):
    group_id: int
    project_id: int
    stacktrace: str
    message: str


class SimilarIssuesEmbeddingsData(TypedDict):
    parent_group_id: int
    stacktrace_distance: float
    message_distance: float
    should_group: bool


class SimilarIssuesEmbeddingsResponse(TypedDict):
    responses: list[SimilarIssuesEmbeddingsData | None]


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
    except AttributeError:
        empty_response: SimilarIssuesEmbeddingsResponse = {"responses": []}
        return empty_response
