from unittest.mock import patch

from rest_framework.test import APIRequestFactory

from sentry.models.repository import Repository
from sentry.preprod.api.endpoints.organization_pullrequest_comments import (
    OrganizationPrCommentsEndpoint,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase


class OrganizationPrCommentsEndpointTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = APIRequestFactory()

        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Test GitHub Integration",
            external_id="12345",
            metadata={
                "access_token": "test-token",
                "expires_at": None,
                "installation": {"id": 12345, "account": {"login": "getsentry"}},
            },
        )

        self.repository = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
        )

        self.mock_general_comments = [
            {
                "id": 1,
                "user": {"login": "testuser1", "id": 123},
                "body": "This looks great!",
                "created_at": "2023-01-01T12:00:00Z",
                "updated_at": "2023-01-01T12:00:00Z",
            },
            {
                "id": 2,
                "user": {"login": "testuser2", "id": 456},
                "body": "Can you add tests?",
                "created_at": "2023-01-02T10:30:00Z",
                "updated_at": "2023-01-02T10:30:00Z",
            },
        ]

        self.mock_review_comments = [
            {
                "id": 10,
                "path": "src/components/Button.tsx",
                "line": 25,
                "user": {"login": "reviewer1", "id": 789},
                "body": "Consider using a const here",
                "created_at": "2023-01-01T14:00:00Z",
            },
            {
                "id": 11,
                "path": "src/components/Button.tsx",
                "line": 30,
                "user": {"login": "reviewer2", "id": 101},
                "body": "Good catch!",
                "created_at": "2023-01-01T15:00:00Z",
            },
            {
                "id": 12,
                "path": "src/utils/helper.ts",
                "line": 10,
                "user": {"login": "reviewer1", "id": 789},
                "body": "This could be simplified",
                "created_at": "2023-01-02T09:00:00Z",
            },
        ]

    def _make_request(self, repo_name="getsentry/sentry", pr_number="100"):
        """Helper to make API request."""
        request = self.factory.get(
            "/", {"repo": repo_name, "pr": pr_number} if repo_name and pr_number else {}
        )
        request.user = self.user
        endpoint = OrganizationPrCommentsEndpoint()
        return endpoint.get(
            request=request,
            organization=self.organization,
        )

    @patch("sentry.integrations.github.client.GitHubApiClient.get")
    def test_successful_pr_comments_fetch(self, mock_get):
        """Test successful fetch of both general and review comments."""

        def mock_get_side_effect(url):
            if "issues" in url:
                return self.mock_general_comments
            elif "pulls" in url:
                return self.mock_review_comments
            return []

        mock_get.side_effect = mock_get_side_effect

        response = self._make_request()
        assert response.status_code == 200

        # Verify both API calls were made
        assert mock_get.call_count == 2
        mock_get.assert_any_call("/repos/getsentry/sentry/issues/100/comments")
        mock_get.assert_any_call("/repos/getsentry/sentry/pulls/100/comments")

        # Verify response structure
        assert "general_comments" in response.data
        assert "file_comments" in response.data

        # Verify general comments
        general_comments = response.data["general_comments"]
        assert len(general_comments) == 2
        assert general_comments[0]["body"] == "This looks great!"
        assert general_comments[1]["body"] == "Can you add tests?"

        # Verify file comments are organized by file
        file_comments = response.data["file_comments"]
        assert len(file_comments) == 2  # Two files have comments
        assert "src/components/Button.tsx" in file_comments
        assert "src/utils/helper.ts" in file_comments

        # Verify Button.tsx has 2 comments
        button_comments = file_comments["src/components/Button.tsx"]
        assert len(button_comments) == 2
        assert button_comments[0]["body"] == "Consider using a const here"
        assert button_comments[1]["body"] == "Good catch!"

        # Verify helper.ts has 1 comment
        helper_comments = file_comments["src/utils/helper.ts"]
        assert len(helper_comments) == 1
        assert helper_comments[0]["body"] == "This could be simplified"

    def test_missing_repo_parameter(self):
        """Test error when repo parameter is missing."""
        request = self.factory.get("/", {"pr": "100"})
        request.user = self.user
        endpoint = OrganizationPrCommentsEndpoint()
        response = endpoint.get(request=request, organization=self.organization)

        assert response.status_code == 400
        assert "Both 'repo' and 'pr' parameters are required" in response.data["detail"]

    def test_missing_pr_parameter(self):
        """Test error when pr parameter is missing."""
        request = self.factory.get("/", {"repo": "getsentry/sentry"})
        request.user = self.user
        endpoint = OrganizationPrCommentsEndpoint()
        response = endpoint.get(request=request, organization=self.organization)

        assert response.status_code == 400
        assert "Both 'repo' and 'pr' parameters are required" in response.data["detail"]

    def test_missing_both_parameters(self):
        """Test error when both parameters are missing."""
        request = self.factory.get("/")
        request.user = self.user
        endpoint = OrganizationPrCommentsEndpoint()
        response = endpoint.get(request=request, organization=self.organization)

        assert response.status_code == 400
        assert "Both 'repo' and 'pr' parameters are required" in response.data["detail"]

    def test_no_github_client(self):
        """Test when no GitHub client is available (no integration set up)."""
        Repository.objects.create(
            organization_id=self.organization.id,
            name="nonexistent/repo",
            provider="integrations:github",
            integration_id=None,  # No integration
        )

        response = self._make_request(repo_name="nonexistent/repo")

        assert response.status_code == 404
        assert response.data["error"] == "integration_not_found"
        assert "No GitHub integration found" in response.data["message"]

    @patch("sentry.integrations.github.client.GitHubApiClient.get")
    def test_github_api_error(self, mock_get):
        """Test GitHub API error handling."""
        # Simulate GitHub API error
        mock_get.side_effect = ApiError("API rate limit exceeded")

        response = self._make_request()

        assert response.status_code == 502
        assert response.data["error"] == "api_error"
        assert "Failed to fetch pull request comments from GitHub" in response.data["message"]

    def test_repository_not_found(self):
        """Test when repository doesn't exist in the database."""
        response = self._make_request(repo_name="does-not/exist")

        assert response.status_code == 404
        assert response.data["error"] == "integration_not_found"
        assert "No GitHub integration found" in response.data["message"]

    @patch("sentry.integrations.github.client.GitHubApiClient.get")
    def test_unexpected_error(self, mock_get):
        """Test handling of unexpected errors."""
        # Simulate unexpected error (not ApiError)
        mock_get.side_effect = ValueError("Unexpected error")

        response = self._make_request()

        assert response.status_code == 500
        assert response.data["error"] == "internal_error"
        assert "An unexpected error occurred" in response.data["message"]
