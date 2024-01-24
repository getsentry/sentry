from typing import List, TypedDict

from django.conf import settings
from urllib3 import HTTPResponse, Retry

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


# TODO: change these to NotRequired fields once Python version is 3.11
class SimilarIssuesEmbeddingsRequestNotRequired(TypedDict, total=False):
    k: int
    threshold: int


class SimilarIssuesEmbeddingsRequest(SimilarIssuesEmbeddingsRequestNotRequired):
    group_id: int
    stacktrace: str
    message: str


class SimilarIssuesEmbeddingsData(TypedDict):
    parent_group_id: int
    stacktrace_similarity: float
    message_similarity: float
    should_group: bool


class SimilarIssuesEmbeddingsReponse(TypedDict):
    responses: List[SimilarIssuesEmbeddingsData]


def get_similar_issues_embeddings(
    similar_issues_request: SimilarIssuesEmbeddingsRequest,
) -> SimilarIssuesEmbeddingsReponse | HTTPResponse:
    """Call /v0/issues/similar-issues endpoint from timeseries-analysis-service."""
    response = seer_connection_pool.urlopen(
        "POST",
        "/v0/issues/similar-issues",
        body=json.dumps(similar_issues_request),
        headers={"Content-Type": "application/json;charset=utf-8"},
    )

    try:
        return json.loads(response.data.decode("utf-8"))
    except Exception:
        return response
