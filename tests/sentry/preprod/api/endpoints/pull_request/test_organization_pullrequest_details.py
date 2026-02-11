from unittest.mock import patch

from rest_framework.test import APIRequestFactory

from sentry.models.repository import Repository
from sentry.preprod.api.endpoints.pull_request.organization_pullrequest_details import (
    OrganizationPullRequestDetailsEndpoint,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class OrganizationPullRequestDetailsEndpointTest(TestCase):
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

        self.mock_pr_details = {
            "id": 123456,
            "number": 100,
            "title": "Add new feature",
            "body": "This PR adds a new feature to improve user experience",
            "state": "open",
            "user": {
                "id": 789,
                "login": "testuser",
                "name": "Test User",
                "avatar_url": "https://github.com/testuser.png",
            },
            "head": {"ref": "feature/new-feature"},
            "base": {"ref": "main"},
            "created_at": "2023-01-01T12:00:00Z",
            "updated_at": "2023-01-02T10:30:00Z",
            "merged_at": None,
            "closed_at": None,
            "html_url": "https://github.com/getsentry/sentry/pull/100",
            "commits": 3,
            "additions": 150,
            "deletions": 50,
            "changed_files": 5,
        }

        self.mock_pr_files = [
            {
                "filename": "src/components/Button.tsx",
                "status": "modified",
                "additions": 10,
                "deletions": 2,
                "changes": 12,
                "sha": "abc123def456",
                "patch": "@@ -1,3 +1,3 @@\n- old line\n+ new line",
            },
            {
                "filename": "src/utils/helper.ts",
                "status": "added",
                "additions": 25,
                "deletions": 0,
                "changes": 25,
                "sha": "def456ghi789",
                "patch": None,
            },
            {
                "filename": "tests/Button.test.tsx",
                "status": "added",
                "additions": 50,
                "deletions": 0,
                "changes": 50,
                "sha": "ghi789jkl012",
                "patch": None,
            },
            {
                "filename": "old-file.js",
                "status": "removed",
                "additions": 0,
                "deletions": 15,
                "changes": 15,
                "sha": None,
                "patch": None,
            },
            {
                "filename": "new-component.tsx",
                "status": "renamed",
                "additions": 5,
                "deletions": 3,
                "changes": 8,
                "previous_filename": "old-component.tsx",
                "sha": "jkl012mno345",
                "patch": None,
            },
        ]

    def _make_request(self, repo_name="getsentry/sentry", pr_number="100"):
        """Helper to make API request."""
        request = self.factory.get("/")
        request.user = self.user
        endpoint = OrganizationPullRequestDetailsEndpoint()
        return endpoint.get(
            request=request,
            organization=self.organization,
            repo_name=repo_name,
            pr_number=pr_number,
        )

    @with_feature("organizations:pr-page")
    @patch("sentry.integrations.github.client.GitHubApiClient.get_pull_request_files")
    @patch("sentry.integrations.github.client.GitHubApiClient.get")
    def test_successful_pr_details_fetch(self, mock_get, mock_get_files):
        """Test successful PR details and files fetch with proper normalization."""
        # Setup GitHub API response mocks (only mock the HTTP calls)
        mock_get_files.return_value = self.mock_pr_files
        mock_get.return_value = self.mock_pr_details

        response = self._make_request()
        assert response.status_code == 200

        mock_get_files.assert_called_once_with("getsentry/sentry", "100")
        mock_get.assert_called_once_with("/repos/getsentry/sentry/pulls/100")

        assert "pull_request" in response.data
        assert "files" in response.data

        pr_data = response.data["pull_request"]
        assert pr_data["id"] == "123456"
        assert pr_data["number"] == 100
        assert pr_data["title"] == "Add new feature"
        assert pr_data["state"] == "open"
        assert pr_data["author"]["username"] == "testuser"
        assert pr_data["author"]["display_name"] == "Test User"
        assert pr_data["source_branch"] == "feature/new-feature"
        assert pr_data["target_branch"] == "main"
        assert pr_data["additions"] == 150
        assert pr_data["deletions"] == 50
        assert pr_data["changed_files_count"] == 5
        assert pr_data["created_at"] is not None

        files_data = response.data["files"]
        assert len(files_data) == 5

        modified_file = files_data[0]
        assert modified_file["filename"] == "src/components/Button.tsx"
        assert modified_file["status"] == "modified"
        assert modified_file["additions"] == 10
        assert modified_file["deletions"] == 2

        added_file = next(f for f in files_data if f["status"] == "added")
        assert added_file["filename"] == "src/utils/helper.ts"

        renamed_file = next(f for f in files_data if f["status"] == "renamed")
        assert renamed_file["previous_filename"] == "old-component.tsx"

    @with_feature("organizations:pr-page")
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

    @with_feature("organizations:pr-page")
    @patch("sentry.integrations.github.client.GitHubApiClient.get_pull_request_files")
    def test_github_api_error(self, mock_get_files):
        """Test GitHub API error handling."""
        # Simulate GitHub API error
        mock_get_files.side_effect = ApiError("API rate limit exceeded")

        response = self._make_request()

        assert response.status_code == 502
        assert response.data["error"] == "api_error"
        assert "Failed to fetch pull request data from GitHub" in response.data["message"]

    @with_feature("organizations:pr-page")
    @patch("sentry.integrations.github.client.GitHubApiClient.get_pull_request_files")
    @patch("sentry.integrations.github.client.GitHubApiClient.get")
    def test_empty_pr_files(self, mock_get, mock_get_files):
        """Test handling of PR with no files changed."""
        mock_get_files.return_value = []
        mock_get.return_value = {**self.mock_pr_details, "changed_files": 0}

        response = self._make_request()

        assert response.status_code == 200
        assert len(response.data["files"]) == 0
        assert response.data["pull_request"]["changed_files_count"] == 0

    @with_feature("organizations:pr-page")
    def test_repository_not_found(self):
        """Test when repository doesn't exist in the database."""
        response = self._make_request(repo_name="does-not/exist")

        assert response.status_code == 404
        assert response.data["error"] == "integration_not_found"
        assert "No GitHub integration found" in response.data["message"]

    @with_feature("organizations:pr-page")
    @patch("sentry.integrations.github.client.GitHubApiClient.get_pull_request_files")
    @patch("sentry.integrations.github.client.GitHubApiClient.get")
    def test_missing_timestamps_handled_correctly(self, mock_get, mock_get_files):
        """Test that missing timestamps are properly handled without type errors."""
        # Create PR data missing created_at and updated_at timestamps
        pr_data_missing_timestamps = {
            "id": 123456,
            "number": 100,
            "title": "Add new feature",
            "body": "This PR adds a new feature to improve user experience",
            "state": "open",
            "user": {
                "id": 789,
                "login": "testuser",
                "name": "Test User",
                "avatar_url": "https://github.com/testuser.png",
            },
            "head": {"ref": "feature/new-feature"},
            "base": {"ref": "main"},
            # Missing created_at and updated_at
            "merged_at": None,
            "closed_at": None,
            "html_url": "https://github.com/getsentry/sentry/pull/100",
            "commits": 3,
            "additions": 150,
            "deletions": 50,
            "changed_files": 0,
        }

        mock_get_files.return_value = []
        mock_get.return_value = pr_data_missing_timestamps

        response = self._make_request()

        assert response.status_code == 200
        assert "pull_request" in response.data

        pr_data = response.data["pull_request"]
        # Verify that missing timestamps are handled as None
        assert pr_data["created_at"] is None
        assert pr_data["updated_at"] is None
        # Verify other fields work correctly
        assert pr_data["id"] == "123456"
        assert pr_data["number"] == 100
        assert pr_data["title"] == "Add new feature"
