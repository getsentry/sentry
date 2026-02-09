from unittest.mock import MagicMock, patch

import requests

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class IssueViewTitleGenerateEndpointTest(APITestCase):
    endpoint = "sentry-api-0-issue-view-title-generate"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/issue-view-title/generate/"

    @with_feature("organizations:issue-view-ai-title")
    @patch("sentry.seer.endpoints.issue_view_title_generate.requests.post")
    def test_successful_title_generation(self, mock_post: MagicMock) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = {"content": "My Assigned Errors"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved assigned:me level:error"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data == {"title": "My Assigned Errors"}
        mock_post.assert_called_once()

    @with_feature("organizations:issue-view-ai-title")
    @patch("sentry.seer.endpoints.issue_view_title_generate.requests.post")
    def test_title_is_stripped(self, mock_post: MagicMock) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = {"content": "  Title With Whitespace  "}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data == {"title": "Title With Whitespace"}

    @with_feature("organizations:issue-view-ai-title")
    def test_missing_query_parameter(self) -> None:
        response = self.client.post(self.url, data={}, format="json")

        assert response.status_code == 400
        assert response.data == {"detail": "Missing required parameter: query"}

    @with_feature("organizations:issue-view-ai-title")
    def test_empty_query_parameter(self) -> None:
        response = self.client.post(self.url, data={"query": ""}, format="json")

        assert response.status_code == 400
        assert response.data == {"detail": "Missing required parameter: query"}

    def test_feature_flag_not_enabled(self) -> None:
        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 403
        assert response.data == {"detail": "Organization does not have access to this feature"}

    @with_feature("organizations:issue-view-ai-title")
    def test_ai_features_disabled_for_org(self) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 403
        assert response.data == {"detail": "AI features are disabled for this organization."}

    @with_feature("organizations:issue-view-ai-title")
    @patch("sentry.seer.endpoints.issue_view_title_generate.requests.post")
    def test_seer_api_error(self, mock_post: MagicMock) -> None:
        mock_post.side_effect = requests.RequestException("Connection error")

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 500
        assert response.data == {"detail": "Failed to generate title"}

    @with_feature("organizations:issue-view-ai-title")
    @patch("sentry.seer.endpoints.issue_view_title_generate.requests.post")
    def test_empty_response_from_seer(self, mock_post: MagicMock) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = {"content": None}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        response = self.client.post(
            self.url,
            data={"query": "is:unresolved"},
            format="json",
        )

        assert response.status_code == 500
        assert response.data == {"detail": "Failed to generate title"}

    @with_feature("organizations:issue-view-ai-title")
    @patch("sentry.seer.endpoints.issue_view_title_generate.requests.post")
    def test_long_query_is_truncated(self, mock_post: MagicMock) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = {"content": "Generated Title"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        long_query = "x" * 600

        response = self.client.post(
            self.url,
            data={"query": long_query},
            format="json",
        )

        assert response.status_code == 200
        call_args = mock_post.call_args
        request_body = call_args.kwargs["data"]
        assert len(long_query[:500]) == 500
        assert b"x" * 500 in request_body
        assert b"x" * 600 not in request_body
