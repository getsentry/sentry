from unittest import TestCase, mock

from urllib3.response import HTTPResponse

from sentry.seer.utils import SimilarIssuesEmbeddingsRequest, get_similar_issues_embeddings
from sentry.utils import json


class TestSimilarIssuesEmbeddingsUtils(TestCase):
    @mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
    def test_simple_similar_issues_embeddings(self, mock_seer_request):
        """Test that valid responses are decoded and returned."""

        expected_return_value = {
            "responses": [
                {
                    "message_similarity": 0.95,
                    "parent_group_id": 6,
                    "should_group": True,
                    "stacktrace_similarity": 0.99,
                }
            ]
        }
        mock_seer_request.return_value = HTTPResponse(
            json.dumps(expected_return_value).encode("utf-8")
        )

        params: SimilarIssuesEmbeddingsRequest = {
            "group_id": 1,
            "project_id": 1,
            "stacktrace": "string",
            "message": "message",
        }
        response = get_similar_issues_embeddings(params)
        assert response == expected_return_value

    @mock.patch("sentry.seer.utils.seer_staging_connection_pool.urlopen")
    def test_empty_similar_issues_embeddings(self, mock_seer_request):
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
