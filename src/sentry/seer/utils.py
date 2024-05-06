import logging
from dataclasses import dataclass
from typing import NotRequired, Self, TypedDict

import sentry_sdk
from django.conf import settings
from urllib3 import Retry

from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.net.http import connection_from_url
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)


class SeerException(Exception):
    pass


class IncompleteSeerDataError(Exception):
    pass


class SimilarGroupNotFoundError(Exception):
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
    project_id: int
    stacktrace: str
    message: str
    k: NotRequired[int]  # how many neighbors to find
    threshold: NotRequired[float]
    group_id: NotRequired[int]  # TODO: Remove this once we stop sending it to seer
    group_hash: NotRequired[str]  # TODO: Make this required once id -> hash change is done


class RawSeerSimilarIssueData(TypedDict):
    stacktrace_distance: float
    message_distance: float
    should_group: bool
    parent_group_id: NotRequired[int]  # TODO: Remove this once seer stops sending it
    parent_group_hash: NotRequired[str]  # TODO: Make this required once id -> hash change is done


class SimilarIssuesEmbeddingsResponse(TypedDict):
    responses: list[RawSeerSimilarIssueData]


# Like the data that comes back from seer, but guaranteed to have a parent group id
@dataclass
class SeerSimilarIssueData:
    stacktrace_distance: float
    message_distance: float
    should_group: bool
    parent_group_id: int
    # TODO: See if we end up needing the hash here
    parent_group_hash: str | None = None

    @classmethod
    def from_raw(cls, project_id: int, raw_similar_issue_data: RawSeerSimilarIssueData) -> Self:
        """
        Create an instance of `SeerSimilarIssueData` from the raw data that comes back from Seer,
        using the parent hash to look up the parent group id. Needs to be run individually on each
        similar issue in the Seer response.

        Throws an `IncompleteSeerDataError` if given data with both parent group id and parent hash
        missing, and a `SimilarGroupNotFoundError` if the data points to a group which no longer
        exists. Thus if this successfully returns, the parent group id it contains is guaranteed to
        point to an existing group.

        """
        similar_issue_data = raw_similar_issue_data
        parent_group_hash = raw_similar_issue_data.get("parent_group_hash")
        parent_group_id = raw_similar_issue_data.get("parent_group_id")

        if not parent_group_id and not parent_group_hash:
            raise IncompleteSeerDataError(
                "Seer similar issues response missing both `parent_group_id` and `parent_group_hash`"
            )

        if parent_group_id:
            if not Group.objects.filter(id=parent_group_id).first():
                raise SimilarGroupNotFoundError("Similar group suggested by Seer does not exist")

        else:
            parent_grouphash = (
                GroupHash.objects.filter(project_id=project_id, hash=parent_group_hash)
                .exclude(state=GroupHash.State.LOCKED_IN_MIGRATION)
                .first()
            )

            if not parent_grouphash:
                # TODO: Report back to seer that the hash has been deleted.
                raise SimilarGroupNotFoundError("Similar group suggested by Seer does not exist")

            similar_issue_data = {
                **raw_similar_issue_data,
                "parent_group_id": parent_grouphash.group_id,
            }

        return cls(**similar_issue_data)


def get_similar_issues_embeddings(
    similar_issues_request: SimilarIssuesEmbeddingsRequest,
) -> list[RawSeerSimilarIssueData]:
    """Call /v0/issues/similar-issues endpoint from seer."""
    response = seer_staging_connection_pool.urlopen(
        "POST",
        "/v0/issues/similar-issues",
        body=json.dumps(similar_issues_request),
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

    return response_data.get("responses") or []
