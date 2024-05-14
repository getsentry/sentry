import logging
from dataclasses import dataclass
from typing import NotRequired, Self, TypedDict

import sentry_sdk
from django.conf import settings
from urllib3 import Retry
from urllib3.exceptions import ReadTimeoutError

from sentry.conf.server import (
    SEER_GROUPING_RECORDS_URL,
    SEER_MAX_GROUPING_DISTANCE,
    SEER_SIMILAR_ISSUES_URL,
    SEER_SIMILARITY_MODEL_VERSION,
)
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.net.http import connection_from_url
from sentry.utils import json, metrics
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

POST_BULK_GROUPING_RECORDS_TIMEOUT = 10000

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


class SimilarIssuesEmbeddingsRequest(TypedDict):
    project_id: int
    stacktrace: str
    message: str
    k: NotRequired[int]  # how many neighbors to find
    threshold: NotRequired[float]
    group_id: NotRequired[int]  # TODO: Remove this once we stop sending it to seer
    hash: NotRequired[str]  # TODO: Make this required once id -> hash change is done


class RawSeerSimilarIssueData(TypedDict):
    stacktrace_distance: float
    message_distance: float
    should_group: bool
    parent_group_id: NotRequired[int]  # TODO: Remove this once seer stops sending it
    parent_hash: NotRequired[str]  # TODO: Make this required once id -> hash change is done


class SimilarIssuesEmbeddingsResponse(TypedDict):
    responses: list[RawSeerSimilarIssueData]


# Like the data that comes back from seer, but guaranteed to have a parent group id
@dataclass
class SeerSimilarIssueData:
    stacktrace_distance: float
    message_distance: float
    should_group: bool
    parent_group_id: int
    similarity_model_version: str = SEER_SIMILARITY_MODEL_VERSION
    # TODO: See if we end up needing the hash here
    parent_hash: str | None = None

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
        parent_hash = raw_similar_issue_data.get("parent_hash")
        parent_group_id = raw_similar_issue_data.get("parent_group_id")

        if not parent_group_id and not parent_hash:
            raise IncompleteSeerDataError(
                "Seer similar issues response missing both `parent_group_id` and `parent_hash`"
            )

        if parent_group_id:
            if not Group.objects.filter(id=parent_group_id).first():
                raise SimilarGroupNotFoundError("Similar group suggested by Seer does not exist")

        else:
            parent_grouphash = (
                GroupHash.objects.filter(project_id=project_id, hash=parent_hash)
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


class CreateGroupingRecordData(TypedDict):
    hash: str
    project_id: int
    message: str


class CreateGroupingRecordsRequest(TypedDict):
    group_id_list: list[int]
    data: list[CreateGroupingRecordData]
    stacktrace_list: list[str]


class BulkCreateGroupingRecordsResponse(TypedDict):
    success: bool


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

def post_bulk_grouping_records(
    grouping_records_request: CreateGroupingRecordsRequest,
) -> BulkCreateGroupingRecordsResponse:
    """Call /v0/issues/similar-issues/grouping-record endpoint from seer."""
    if not grouping_records_request.get("data"):
        return {"success": True}

    extra = {
        "group_ids": json.dumps(grouping_records_request["group_id_list"]),
        "project_id": grouping_records_request["data"][0]["project_id"],
    }

    try:
        response = seer_grouping_connection_pool.urlopen(
            "POST",
            SEER_GROUPING_RECORDS_URL,
            body=json.dumps(grouping_records_request),
            headers={"Content-Type": "application/json;charset=utf-8"},
            timeout=POST_BULK_GROUPING_RECORDS_TIMEOUT,
        )
    except ReadTimeoutError:
        extra.update({"reason": "ReadTimeoutError", "timeout": POST_BULK_GROUPING_RECORDS_TIMEOUT})
        logger.info("seer.post_bulk_grouping_records.failure", extra=extra)
        return {"success": False}

    if response.status >= 200 and response.status < 300:
        logger.info("seer.post_bulk_grouping_records.success", extra=extra)
        return json.loads(response.data.decode("utf-8"))
    else:
        extra.update({"reason": response.reason})
        logger.info("seer.post_bulk_grouping_records.failure", extra=extra)
        return {"success": False}
