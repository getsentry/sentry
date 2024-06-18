import logging

from django.conf import settings

from sentry.conf.server import SEER_MAX_GROUPING_DISTANCE, SEER_SIMILAR_ISSUES_URL
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.seer.similarity.types import (
    IncompleteSeerDataError,
    SeerSimilarIssueData,
    SimilarGroupNotFoundError,
    SimilarIssuesEmbeddingsRequest,
)
from sentry.utils import json, metrics
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)


seer_grouping_connection_pool = connection_from_url(
    settings.SEER_GROUPING_URL,
    timeout=settings.SEER_GROUPING_TIMEOUT,
)


# TODO: Handle non-200 responses
def get_similarity_data_from_seer(
    similar_issues_request: SimilarIssuesEmbeddingsRequest,
) -> list[SeerSimilarIssueData]:
    """
    Request similar issues data from seer and normalize the results. Returns similar groups
    sorted in order of descending similarity.
    """

    response = make_signed_seer_api_request(
        seer_grouping_connection_pool,
        SEER_SIMILAR_ISSUES_URL,
        json.dumps({"threshold": SEER_MAX_GROUPING_DISTANCE, **similar_issues_request}).encode(
            "utf8"
        ),
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
                "response_code": response.status,
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
