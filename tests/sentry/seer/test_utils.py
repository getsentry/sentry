from typing import Any
from unittest import mock

import pytest
from urllib3.response import HTTPResponse

from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import (
    RawSeerSimilarIssueData,
    SeerSimilarIssueData,
    SimilarIssuesEmbeddingsRequest,
)
from sentry.seer.utils import detect_breakpoints
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from sentry.utils.types import NonNone


@mock.patch("sentry.seer.utils.seer_breakpoint_connection_pool.urlopen")
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
@mock.patch("sentry.seer.utils.seer_breakpoint_connection_pool.urlopen")
def test_detect_breakpoints_errors(mock_urlopen, mock_capture_exception, body, status):
    mock_urlopen.return_value = HTTPResponse(body, status=status)

    assert detect_breakpoints({}) == {"data": []}
    assert mock_capture_exception.called


@django_db_all
@mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
def test_similar_issues_embeddings_simple(mock_seer_request, default_project):
    """Test that valid responses are decoded and returned."""
    event = save_new_event({"message": "Dogs are great!"}, default_project)
    similar_event = save_new_event({"message": "Adopt don't shop"}, default_project)

    raw_similar_issue_data: RawSeerSimilarIssueData = {
        "message_distance": 0.05,
        "parent_hash": NonNone(similar_event.get_primary_hash()),
        "should_group": True,
        "stacktrace_distance": 0.01,
    }

    seer_return_value = {"responses": [raw_similar_issue_data]}
    mock_seer_request.return_value = HTTPResponse(json.dumps(seer_return_value).encode("utf-8"))

    params: SimilarIssuesEmbeddingsRequest = {
        "hash": NonNone(event.get_primary_hash()),
        "project_id": default_project.id,
        "stacktrace": "string",
        "message": "message",
    }

    similar_issue_data: Any = {
        **raw_similar_issue_data,
        "parent_group_id": similar_event.group_id,
    }

    assert get_similarity_data_from_seer(params) == [SeerSimilarIssueData(**similar_issue_data)]


@django_db_all
@mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
def test_empty_similar_issues_embeddings(mock_seer_request, default_project):
    """Test that empty responses are returned."""
    event = save_new_event({"message": "Dogs are great!"}, default_project)

    mock_seer_request.return_value = HTTPResponse([])

    params: SimilarIssuesEmbeddingsRequest = {
        "hash": NonNone(event.get_primary_hash()),
        "project_id": default_project.id,
        "stacktrace": "string",
        "message": "message",
    }
    assert get_similarity_data_from_seer(params) == []


@django_db_all
@mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
def test_returns_sorted_similarity_results(mock_seer_request, default_project):
    event = save_new_event({"message": "Dogs are great!"}, default_project)
    similar_event = save_new_event({"message": "Adopt don't shop"}, default_project)
    less_similar_event = save_new_event({"message": "Charlie is goofy"}, default_project)

    raw_similar_issue_data: RawSeerSimilarIssueData = {
        "message_distance": 0.05,
        "parent_hash": NonNone(similar_event.get_primary_hash()),
        "should_group": True,
        "stacktrace_distance": 0.01,
    }
    raw_less_similar_issue_data: RawSeerSimilarIssueData = {
        "message_distance": 0.10,
        "parent_hash": NonNone(less_similar_event.get_primary_hash()),
        "should_group": False,
        "stacktrace_distance": 0.05,
    }

    # Note that the less similar issue is first in the list as it comes back from Seer
    seer_return_value = {"responses": [raw_less_similar_issue_data, raw_similar_issue_data]}
    mock_seer_request.return_value = HTTPResponse(json.dumps(seer_return_value).encode("utf-8"))

    params: SimilarIssuesEmbeddingsRequest = {
        "hash": NonNone(event.get_primary_hash()),
        "project_id": default_project.id,
        "stacktrace": "string",
        "message": "message",
    }

    similar_issue_data: Any = {
        **raw_similar_issue_data,
        "parent_group_id": similar_event.group_id,
    }
    less_similar_issue_data: Any = {
        **raw_less_similar_issue_data,
        "parent_group_id": less_similar_event.group_id,
    }

    # The results have been reordered so that the more similar issue comes first
    assert get_similarity_data_from_seer(params) == [
        SeerSimilarIssueData(**similar_issue_data),
        SeerSimilarIssueData(**less_similar_issue_data),
    ]
