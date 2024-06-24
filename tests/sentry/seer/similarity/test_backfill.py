import copy
from unittest import mock
from unittest.mock import MagicMock

import pytest
from django.conf import settings
from urllib3.connectionpool import ConnectionPool
from urllib3.exceptions import ReadTimeoutError
from urllib3.response import HTTPResponse

from sentry.seer.similarity.backfill import (
    POST_BULK_GROUPING_RECORDS_TIMEOUT,
    CreateGroupingRecordsRequest,
    post_bulk_grouping_records,
)
from sentry.utils import json

DUMMY_POOL = ConnectionPool("dummy")
CREATE_GROUPING_RECORDS_REQUEST_PARAMS: CreateGroupingRecordsRequest = {
    "group_id_list": [1, 2],
    "data": [
        {
            "group_id": 1,
            "hash": "hash-1",
            "project_id": 1,
            "message": "message",
            "exception_type": "Error",
        },
        {
            "group_id": 2,
            "hash": "hash-2",
            "project_id": 1,
            "message": "message 2",
            "exception_type": "Error",
        },
    ],
    "stacktrace_list": ["stacktrace 1", "stacktrace 2"],
}


@pytest.mark.django_db
@mock.patch("sentry.seer.similarity.backfill.logger")
@mock.patch("sentry.seer.similarity.backfill.seer_grouping_connection_pool.urlopen")
def test_post_bulk_grouping_records_success(mock_seer_request: MagicMock, mock_logger: MagicMock):
    expected_return_value = {
        "success": True,
        "groups_with_neighbor": {"1": "00000000000000000000000000000000"},
    }
    mock_seer_request.return_value = HTTPResponse(
        json.dumps(expected_return_value).encode("utf-8"), status=200
    )

    response = post_bulk_grouping_records(CREATE_GROUPING_RECORDS_REQUEST_PARAMS)
    assert response == expected_return_value
    mock_logger.info.assert_called_with(
        "seer.post_bulk_grouping_records.success",
        extra={
            "group_ids": json.dumps(CREATE_GROUPING_RECORDS_REQUEST_PARAMS["group_id_list"]),
            "project_id": 1,
            "stacktrace_length_sum": 24,
        },
    )


@pytest.mark.django_db
@mock.patch("sentry.seer.similarity.backfill.logger")
@mock.patch("sentry.seer.similarity.backfill.seer_grouping_connection_pool.urlopen")
def test_post_bulk_grouping_records_timeout(mock_seer_request: MagicMock, mock_logger: MagicMock):
    expected_return_value = {"success": False}
    mock_seer_request.side_effect = ReadTimeoutError(
        DUMMY_POOL, settings.SEER_AUTOFIX_URL, "read timed out"
    )

    response = post_bulk_grouping_records(CREATE_GROUPING_RECORDS_REQUEST_PARAMS)
    assert response == expected_return_value
    mock_logger.info.assert_called_with(
        "seer.post_bulk_grouping_records.failure",
        extra={
            "group_ids": json.dumps(CREATE_GROUPING_RECORDS_REQUEST_PARAMS["group_id_list"]),
            "project_id": 1,
            "reason": "ReadTimeoutError",
            "timeout": POST_BULK_GROUPING_RECORDS_TIMEOUT,
            "stacktrace_length_sum": 24,
        },
    )


@pytest.mark.django_db
@mock.patch("sentry.seer.similarity.backfill.logger")
@mock.patch("sentry.seer.similarity.backfill.seer_grouping_connection_pool.urlopen")
def test_post_bulk_grouping_records_failure(mock_seer_request: MagicMock, mock_logger: MagicMock):
    expected_return_value = {"success": False}
    mock_seer_request.return_value = HTTPResponse(
        b"<!doctype html>\n<html lang=en>\n<title>500 Internal Server Error</title>\n<h1>Internal Server Error</h1>\n<p>The server encountered an internal error and was unable to complete your request. Either the server is overloaded or there is an error in the application.</p>\n",
        reason="INTERNAL SERVER ERROR",
        status=500,
    )

    response = post_bulk_grouping_records(CREATE_GROUPING_RECORDS_REQUEST_PARAMS)
    assert response == expected_return_value
    mock_logger.info.assert_called_with(
        "seer.post_bulk_grouping_records.failure",
        extra={
            "group_ids": json.dumps(CREATE_GROUPING_RECORDS_REQUEST_PARAMS["group_id_list"]),
            "project_id": 1,
            "reason": "INTERNAL SERVER ERROR",
            "stacktrace_length_sum": 24,
        },
    )


@pytest.mark.django_db
@mock.patch("sentry.seer.similarity.backfill.seer_grouping_connection_pool.urlopen")
def test_post_bulk_grouping_records_empty_data(mock_seer_request: MagicMock):
    """Test that function handles empty data. This should not happen, but we do not want to error if it does."""
    expected_return_value = {"success": True}
    mock_seer_request.return_value = HTTPResponse(
        json.dumps(expected_return_value).encode("utf-8"), status=200
    )
    empty_data = copy.deepcopy(CREATE_GROUPING_RECORDS_REQUEST_PARAMS)
    empty_data["data"] = []
    response = post_bulk_grouping_records(empty_data)
    assert response == expected_return_value
