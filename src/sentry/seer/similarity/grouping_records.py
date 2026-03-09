from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import TypedDict

from django.conf import settings
from urllib3.exceptions import MaxRetryError, ReadTimeoutError, TimeoutError

from sentry import options
from sentry.conf.server import (
    SEER_HASH_GROUPING_RECORDS_DELETE_URL,
    SEER_PROJECT_GROUPING_RECORDS_DELETE_URL,
)
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)

POST_BULK_GROUPING_RECORDS_TIMEOUT = 10000
DELETE_HASH_METRIC = "grouping.similarity.delete_records_by_hash"


class CreateGroupingRecordData(TypedDict):
    group_id: int
    hash: str
    project_id: int
    exception_type: str | None


seer_grouping_connection_pool = connection_from_url(settings.SEER_GROUPING_URL)


def call_seer_to_delete_project_grouping_records(
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


def call_seer_to_delete_these_hashes(project_id: int, hashes: Sequence[str]) -> bool:
    extra = {"project_id": project_id, "hashes": hashes}
    try:
        body = json.dumps({"project_id": project_id, "hash_list": hashes}).encode("utf-8")
        response = make_signed_seer_api_request(
            seer_grouping_connection_pool,
            SEER_HASH_GROUPING_RECORDS_DELETE_URL,
            body=body,
            timeout=POST_BULK_GROUPING_RECORDS_TIMEOUT,
        )
    except (TimeoutError, MaxRetryError) as e:
        extra.update({"reason": type(e).__name__, "timeout": POST_BULK_GROUPING_RECORDS_TIMEOUT})
        logger.exception(
            "seer.delete_grouping_records.hashes.timeout",
            extra=extra,
        )
        metrics.incr(
            DELETE_HASH_METRIC,
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"success": False, "reason": type(e).__name__},
        )
        return False

    if response.status >= 200 and response.status < 300:
        logger.info(
            "seer.delete_grouping_records.hashes.success",
            extra=extra,
        )
        metrics.incr(
            DELETE_HASH_METRIC,
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"success": True},
        )
        return True
    else:
        logger.error("seer.delete_grouping_records.hashes.failure", extra=extra)
        metrics.incr(
            DELETE_HASH_METRIC,
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"success": False},
        )
        return False
