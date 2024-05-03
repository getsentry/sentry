from unittest import mock

import pytest
from django.conf import settings
from urllib3.connectionpool import ConnectionPool
from urllib3.exceptions import ReadTimeoutError
from urllib3.response import HTTPResponse

from sentry.seer.utils import (
    POST_BULK_GROUPING_RECORDS_TIMEOUT,
    CreateGroupingRecordsRequest,
    SimilarIssuesEmbeddingsRequest,
    detect_breakpoints,
    get_similar_issues_embeddings,
    post_bulk_grouping_records,
)
from sentry.utils import json

DUMMY_POOL = ConnectionPool("dummy")
CREATE_GROUPING_RECORDS_REQUEST_PARAMS: CreateGroupingRecordsRequest = {
    "group_id_list": [1, 2],
    "data": [
        {"hash": "hash-1", "project_id": 1, "message": "message"},
        {"hash": "hash-2", "project_id": 1, "message": "message 2"},
    ],
    "stacktrace_list": ["stacktrace 1", "stacktrace 2"],
}


@mock.patch("sentry.seer.utils.seer_connection_pool.urlopen")
def test_detect_breakpoints(mock_urlopen):
    data = {
        "data": [
            {
                "project": "1",
                "transaction": "foo",
                "aggregate_range_1": 1.0,
                "aggregate_range_2": 2.0,
                "unweighted_t_value": 0.5,
                "unweighted_p_value": 0.5,
                "trend_percentage": 1.0,
                "absolute_percentage_change": 1.0,
                "trend_difference": 1.0,
                "breakpoint": 100,
            },
        ],
    }
    mock_urlopen.return_value = HTTPResponse(json.dumps(data), status=200)

    assert detect_breakpoints({}) == data


@pytest.mark.parametrize(
    ["body", "status"],
    [
        pytest.param("this is not json", 200, id="200 with non json body"),
        pytest.param("this is not json", 400, id="400 with non json body"),
        pytest.param("{}", 400, id="400 with json body"),
    ],
)
@mock.patch("sentry_sdk.capture_exception")
@mock.patch("sentry.seer.utils.seer_connection_pool.urlopen")
def test_detect_breakpoints_errors(mock_urlopen, mock_capture_exception, body, status):
    mock_urlopen.return_value = HTTPResponse(body, status=status)

    assert detect_breakpoints({}) == {"data": []}
    assert mock_capture_exception.called


@mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
def test_get_similar_issues_embeddings_simple(mock_seer_request):
    """Test that valid responses are decoded and returned."""

    expected_return_value = {
        "responses": [
            {
                "message_distance": 0.05,
                "parent_group_id": 6,
                "should_group": True,
                "stacktrace_distance": 0.01,
            }
        ]
    }
    mock_seer_request.return_value = HTTPResponse(json.dumps(expected_return_value).encode("utf-8"))

    params: SimilarIssuesEmbeddingsRequest = {
        "group_id": 1,
        "project_id": 1,
        "stacktrace": "string",
        "message": "message",
    }
    response = get_similar_issues_embeddings(params)
    assert response == expected_return_value


@mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
def test_get_similar_issues_embeddings_empty(mock_seer_request):
    """Test that empty responses are returned."""

    mock_seer_request.return_value = HTTPResponse([])

    params: SimilarIssuesEmbeddingsRequest = {
        "group_id": 1,
        "project_id": 1,
        "stacktrace": "string",
        "message": "message",
    }
    response = get_similar_issues_embeddings(params)
    assert response == {"responses": []}


@mock.patch("sentry.seer.utils.logger")
@mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
def test_post_bulk_grouping_records_success(mock_seer_request, mock_logger):
    expected_return_value = {"success": True}
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
        },
    )


@mock.patch("sentry.seer.utils.logger")
@mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
def test_post_bulk_grouping_records_timeout(mock_seer_request, mock_logger):
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
        },
    )


@mock.patch("sentry.seer.utils.logger")
@mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
def test_post_bulk_grouping_records_failure(mock_seer_request, mock_logger):
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
        },
    )
