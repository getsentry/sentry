import logging
from typing import NotRequired, TypedDict

from django.conf import settings
from urllib3.exceptions import ReadTimeoutError

from sentry import options
from sentry.conf.server import (
    SEER_GROUPING_RECORDS_URL,
    SEER_HASH_GROUPING_RECORDS_DELETE_URL,
    SEER_PROJECT_GROUPING_RECORDS_DELETE_URL,
)
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.seer.similarity.types import RawSeerSimilarIssueData
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

POST_BULK_GROUPING_RECORDS_TIMEOUT = 10000


class CreateGroupingRecordData(TypedDict):
    group_id: int
    hash: str
    project_id: int
    message: str
    exception_type: str | None


class CreateGroupingRecordsRequest(TypedDict):
    group_id_list: list[int]
    data: list[CreateGroupingRecordData]
    stacktrace_list: list[str]
    use_reranking: bool | None


class BulkCreateGroupingRecordsResponse(TypedDict):
    success: bool
    groups_with_neighbor: NotRequired[dict[str, RawSeerSimilarIssueData]]
    reason: NotRequired[str | None]


seer_grouping_connection_pool = connection_from_url(
    settings.SEER_GROUPING_BACKFILL_URL,
    timeout=settings.SEER_GROUPING_TIMEOUT,
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
        "stacktrace_length_sum": sum(
            [len(stacktrace) for stacktrace in grouping_records_request["stacktrace_list"]]
        ),
        "use_reranking": grouping_records_request.get("use_reranking"),
    }

    try:
        response = make_signed_seer_api_request(
            seer_grouping_connection_pool,
            SEER_GROUPING_RECORDS_URL,
            body=json.dumps(grouping_records_request).encode("utf-8"),
            timeout=POST_BULK_GROUPING_RECORDS_TIMEOUT,
        )
    except ReadTimeoutError:
        extra.update({"reason": "ReadTimeoutError", "timeout": POST_BULK_GROUPING_RECORDS_TIMEOUT})
        logger.info("seer.post_bulk_grouping_records.failure", extra=extra)
        return {"success": False, "reason": "ReadTimeoutError"}

    if response.status >= 200 and response.status < 300:
        logger.info("seer.post_bulk_grouping_records.success", extra=extra)
        return json.loads(response.data.decode("utf-8"))
    else:
        extra.update({"reason": response.reason})
        logger.info("seer.post_bulk_grouping_records.failure", extra=extra)
        return {"success": False, "reason": response.reason}


def delete_project_grouping_records(
    project_id: int,
) -> bool:
    try:
        # TODO: Move this over to POST json_api implementation
        response = seer_grouping_connection_pool.urlopen(
            "GET",
            f"{SEER_PROJECT_GROUPING_RECORDS_DELETE_URL}/{project_id}",
            headers={"Content-Type": "application/json;charset=utf-8"},
            timeout=POST_BULK_GROUPING_RECORDS_TIMEOUT,
        )
    except ReadTimeoutError:
        logger.exception(
            "seer.delete_grouping_records.project.timeout",
            extra={"reason": "ReadTimeoutError", "timeout": POST_BULK_GROUPING_RECORDS_TIMEOUT},
        )
        return False

    if response.status >= 200 and response.status < 300:
        logger.info(
            "seer.delete_grouping_records.project.success",
            extra={"project_id": project_id},
        )
        metrics.incr(
            "grouping.similarity.delete_records_by_project",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"success": True},
        )
        return True
    else:
        logger.error(
            "seer.delete_grouping_records.project.failure",
        )
        metrics.incr(
            "grouping.similarity.delete_records_by_project",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"success": False},
        )
        return False


def delete_grouping_records_by_hash(project_id: int, hashes: list[str]) -> bool:
    extra = {"project_id": project_id, "hashes": hashes}
    try:
        body = {"project_id": project_id, "hash_list": hashes}
        response = seer_grouping_connection_pool.urlopen(
            "POST",
            SEER_HASH_GROUPING_RECORDS_DELETE_URL,
            body=json.dumps(body),
            headers={"Content-Type": "application/json;charset=utf-8"},
            timeout=POST_BULK_GROUPING_RECORDS_TIMEOUT,
        )
    except ReadTimeoutError:
        extra.update({"reason": "ReadTimeoutError", "timeout": POST_BULK_GROUPING_RECORDS_TIMEOUT})
        logger.exception(
            "seer.delete_grouping_records.hashes.timeout",
            extra=extra,
        )
        return False

    if response.status >= 200 and response.status < 300:
        logger.info(
            "seer.delete_grouping_records.hashes.success",
            extra=extra,
        )
        metrics.incr(
            "grouping.similarity.delete_records_by_hash",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"success": True},
        )
        return True
    else:
        logger.error("seer.delete_grouping_records.hashes.failure", extra=extra)
        metrics.incr(
            "grouping.similarity.delete_records_by_hash",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"success": False},
        )
        return False
