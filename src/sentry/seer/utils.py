import logging
from typing import TypedDict

import sentry_sdk
from django.conf import settings
from urllib3 import Retry

from sentry.conf.server import SEER_MAX_GROUPING_DISTANCE, SEER_SIMILAR_ISSUES_URL
from sentry.net.http import connection_from_url
from sentry.seer.similarity.types import (
    IncompleteSeerDataError,
    SeerSimilarIssueData,
    SimilarGroupNotFoundError,
    SimilarIssuesEmbeddingsRequest,
)
from sentry.utils import json, metrics
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)


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


seer_grouping_connection_pool = connection_from_url(
    settings.SEER_GROUPING_URL,
    timeout=settings.SEER_GROUPING_TIMEOUT,
)

seer_breakpoint_connection_pool = connection_from_url(
    settings.SEER_BREAKPOINT_DETECTION_URL,
    retries=Retry(
        total=5,
        status_forcelist=[408, 429, 502, 503, 504],
    ),
    timeout=settings.SEER_BREAKPOINT_DETECTION_TIMEOUT,
)


def detect_breakpoints(breakpoint_request) -> BreakpointResponse:
    response = seer_breakpoint_connection_pool.urlopen(
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


# TODO: Handle non-200 responses
def get_similarity_data_from_seer(
    similar_issues_request: SimilarIssuesEmbeddingsRequest,
) -> list[SeerSimilarIssueData]:
    """
    Request similar issues data from seer and normalize the results. Returns similar groups
    sorted in order of descending similarity.
    """

    response = seer_grouping_connection_pool.urlopen(
        "POST",
        SEER_SIMILAR_ISSUES_URL,
        body=json.dumps({"threshold": SEER_MAX_GROUPING_DISTANCE, **similar_issues_request}),
        headers={"Content-Type": "application/json;charset=utf-8"},
    )

    try:
        response_data = json.loads(response.data.decode("utf-8"))
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
        return []

    normalized = []

    for raw_similar_issue_data in response_data.get("responses") or []:
        try:
            normalized.append(
                SeerSimilarIssueData.from_raw(
                    similar_issues_request["project_id"], raw_similar_issue_data
                )
            )
            metrics.incr("seer.similar_issue_request.parent_issue", tags={"outcome": "found"})
        except IncompleteSeerDataError as err:
            metrics.incr(
                "seer.similar_issue_request.parent_issue", tags={"outcome": "incomplete_data"}
            )
            logger.exception(
                str(err),
                extra={
                    "request_params": similar_issues_request,
                    "raw_similar_issue_data": raw_similar_issue_data,
                },
            )
        except SimilarGroupNotFoundError:
            metrics.incr("seer.similar_issue_request.parent_issue", tags={"outcome": "not_found"})

    return sorted(
        normalized,
        key=lambda issue_data: issue_data.stacktrace_distance,
    )
