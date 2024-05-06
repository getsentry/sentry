from unittest import mock

import pytest
from urllib3.response import HTTPResponse

from sentry.seer.utils import (
    SimilarIssuesEmbeddingsRequest,
    detect_breakpoints,
    get_similar_issues_embeddings,
)
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from sentry.utils.types import NonNone


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


@django_db_all
@mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
def test_simple_similar_issues_embeddings(mock_seer_request, default_project):
    """Test that valid responses are decoded and returned."""
    event = save_new_event({"message": "Dogs are great!"}, default_project)
    similar_event = save_new_event({"message": "Adopt don't shop"}, default_project)

    raw_similar_issue_data = {
        "message_distance": 0.05,
        "parent_group_id": NonNone(similar_event.group_id),
        "should_group": True,
        "stacktrace_distance": 0.01,
    }

    seer_return_value = {"responses": [raw_similar_issue_data]}
    mock_seer_request.return_value = HTTPResponse(json.dumps(seer_return_value).encode("utf-8"))

    params: SimilarIssuesEmbeddingsRequest = {
        "group_id": NonNone(event.group_id),
        "project_id": default_project.id,
        "stacktrace": "string",
        "message": "message",
    }
    response = get_similar_issues_embeddings(params)
    assert response == [raw_similar_issue_data]


@django_db_all
@mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
def test_empty_similar_issues_embeddings(mock_seer_request, default_project):
    """Test that empty responses are returned."""
    event = save_new_event({"message": "Dogs are great!"}, default_project)

    mock_seer_request.return_value = HTTPResponse([])

    params: SimilarIssuesEmbeddingsRequest = {
        "group_id": NonNone(event.group_id),
        "project_id": default_project.id,
        "stacktrace": "string",
        "message": "message",
    }
    response = get_similar_issues_embeddings(params)
    assert response == []
