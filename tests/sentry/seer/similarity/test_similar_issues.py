from typing import Any
from unittest import mock
from unittest.mock import MagicMock

from urllib3.response import HTTPResponse

from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import (
    RawSeerSimilarIssueData,
    SeerSimilarIssueData,
    SimilarIssuesEmbeddingsRequest,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.utils import json
from sentry.utils.types import NonNone


class GetSimilarityDataFromSeerTest(TestCase):
    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_similar_issues_embeddings_simple(self, mock_seer_request: MagicMock):
        """Test that valid responses are decoded and returned."""
        event = save_new_event({"message": "Dogs are great!"}, self.project)
        similar_event = save_new_event({"message": "Adopt don't shop"}, self.project)

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
            "project_id": self.project.id,
            "stacktrace": "string",
            "message": "message",
            "exception_type": "FailedToFetchError",
        }

        similar_issue_data: Any = {
            **raw_similar_issue_data,
            "parent_group_id": similar_event.group_id,
        }

        assert get_similarity_data_from_seer(params) == [SeerSimilarIssueData(**similar_issue_data)]

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_empty_similar_issues_embeddings(self, mock_seer_request: MagicMock):
        """Test that empty responses are returned."""
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        mock_seer_request.return_value = HTTPResponse([])

        params: SimilarIssuesEmbeddingsRequest = {
            "hash": NonNone(event.get_primary_hash()),
            "project_id": self.project.id,
            "stacktrace": "string",
            "message": "message",
            "exception_type": "FailedToFetchError",
        }
        assert get_similarity_data_from_seer(params) == []

    @mock.patch("sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen")
    def test_returns_sorted_similarity_results(self, mock_seer_request: MagicMock):
        event = save_new_event({"message": "Dogs are great!"}, self.project)
        similar_event = save_new_event({"message": "Adopt don't shop"}, self.project)
        less_similar_event = save_new_event({"message": "Charlie is goofy"}, self.project)

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
            "project_id": self.project.id,
            "stacktrace": "string",
            "message": "message",
            "exception_type": "FailedToFetchError",
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
