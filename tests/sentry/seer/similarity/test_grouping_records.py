from typing import int
from unittest import mock
from unittest.mock import MagicMock

from urllib3.connectionpool import ConnectionPool
from urllib3.exceptions import ReadTimeoutError
from urllib3.response import HTTPResponse

from sentry.conf.server import SEER_HASH_GROUPING_RECORDS_DELETE_URL
from sentry.seer.similarity.grouping_records import (
    POST_BULK_GROUPING_RECORDS_TIMEOUT,
    call_seer_to_delete_these_hashes,
)
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json

DUMMY_POOL = ConnectionPool("dummy")


@django_db_all
@mock.patch("sentry.seer.similarity.grouping_records.logger")
@mock.patch("sentry.seer.similarity.grouping_records.seer_grouping_connection_pool.urlopen")
def test_delete_grouping_records_by_hash_success(
    mock_seer_request: MagicMock, mock_logger: MagicMock
):
    mock_seer_request.return_value = HTTPResponse(
        json.dumps({"success": True}).encode("utf-8"), status=200
    )

    project_id, hashes = 1, ["1", "2"]
    response = call_seer_to_delete_these_hashes(project_id, hashes)
    assert response is True
    mock_logger.info.assert_called_with(
        "seer.delete_grouping_records.hashes.success",
        extra={
            "hashes": hashes,
            "project_id": project_id,
        },
    )


@django_db_all
@mock.patch("sentry.seer.similarity.grouping_records.logger")
@mock.patch("sentry.seer.similarity.grouping_records.seer_grouping_connection_pool.urlopen")
def test_delete_grouping_records_by_hash_timeout(
    mock_seer_request: MagicMock, mock_logger: MagicMock
):
    mock_seer_request.side_effect = ReadTimeoutError(
        DUMMY_POOL, SEER_HASH_GROUPING_RECORDS_DELETE_URL, "read timed out"
    )
    project_id, hashes = 1, ["1", "2"]
    response = call_seer_to_delete_these_hashes(project_id, hashes)
    assert response is False
    mock_logger.exception.assert_called_with(
        "seer.delete_grouping_records.hashes.timeout",
        extra={
            "hashes": hashes,
            "project_id": project_id,
            "reason": "ReadTimeoutError",
            "timeout": POST_BULK_GROUPING_RECORDS_TIMEOUT,
        },
    )


@django_db_all
@mock.patch("sentry.seer.similarity.grouping_records.logger")
@mock.patch("sentry.seer.similarity.grouping_records.seer_grouping_connection_pool.urlopen")
def test_delete_grouping_records_by_hash_failure(
    mock_seer_request: MagicMock, mock_logger: MagicMock
):
    mock_seer_request.return_value = HTTPResponse(
        b"<!doctype html>\n<html lang=en>\n<title>500 Internal Server Error</title>\n<h1>Internal Server Error</h1>\n<p>The server encountered an internal error and was unable to complete your request. Either the server is overloaded or there is an error in the application.</p>\n",
        reason="INTERNAL SERVER ERROR",
        status=500,
    )
    project_id, hashes = 1, ["1", "2"]
    response = call_seer_to_delete_these_hashes(project_id, hashes)
    assert response is False
    mock_logger.error.assert_called_with(
        "seer.delete_grouping_records.hashes.failure",
        extra={
            "hashes": hashes,
            "project_id": project_id,
        },
    )
