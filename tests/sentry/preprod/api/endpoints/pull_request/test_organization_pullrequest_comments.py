from typing import int
from unittest.mock import patch

from rest_framework.test import APIRequestFactory

from sentry.models.repository import Repository
from sentry.preprod.api.endpoints.pull_request.organization_pullrequest_comments import (
    OrganizationPrCommentsEndpoint,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


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
                "node_id": "IC_test1",
                "url": "https://api.github.com/repos/getsentry/sentry/issues/comments/1",
                "html_url": "https://github.com/getsentry/sentry/pull/100#issuecomment-1",
                "body": "This looks great!",
                "user": {
                    "login": "testuser1",
                    "id": 123,
                    "node_id": "U_test1",
                    "avatar_url": "https://avatars.githubusercontent.com/u/123",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/testuser1",
                    "html_url": "https://github.com/testuser1",
                    "followers_url": "https://api.github.com/users/testuser1/followers",
                    "following_url": "https://api.github.com/users/testuser1/following{/other_user}",
                    "gists_url": "https://api.github.com/users/testuser1/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/testuser1/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/testuser1/subscriptions",
                    "organizations_url": "https://api.github.com/users/testuser1/orgs",
                    "repos_url": "https://api.github.com/users/testuser1/repos",
                    "events_url": "https://api.github.com/users/testuser1/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/testuser1/received_events",
                    "type": "User",
                    "site_admin": False,
                },
                "created_at": "2023-01-01T12:00:00Z",
                "updated_at": "2023-01-01T12:00:00Z",
                "issue_url": "https://api.github.com/repos/getsentry/sentry/issues/100",
                "author_association": "CONTRIBUTOR",
            },
            {
                "id": 2,
                "node_id": "IC_test2",
                "url": "https://api.github.com/repos/getsentry/sentry/issues/comments/2",
                "html_url": "https://github.com/getsentry/sentry/pull/100#issuecomment-2",
                "body": "Can you add tests?",
                "user": {
                    "login": "testuser2",
                    "id": 456,
                    "node_id": "U_test2",
                    "avatar_url": "https://avatars.githubusercontent.com/u/456",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/testuser2",
                    "html_url": "https://github.com/testuser2",
                    "followers_url": "https://api.github.com/users/testuser2/followers",
                    "following_url": "https://api.github.com/users/testuser2/following{/other_user}",
                    "gists_url": "https://api.github.com/users/testuser2/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/testuser2/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/testuser2/subscriptions",
                    "organizations_url": "https://api.github.com/users/testuser2/orgs",
                    "repos_url": "https://api.github.com/users/testuser2/repos",
                    "events_url": "https://api.github.com/users/testuser2/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/testuser2/received_events",
                    "type": "User",
                    "site_admin": False,
                },
                "created_at": "2023-01-02T10:30:00Z",
                "updated_at": "2023-01-02T10:30:00Z",
                "issue_url": "https://api.github.com/repos/getsentry/sentry/issues/100",
                "author_association": "MEMBER",
            },
        ]

        self.mock_review_comments = [
            {
                "id": 10,
                "node_id": "RC_test10",
                "url": "https://api.github.com/repos/getsentry/sentry/pulls/comments/10",
                "html_url": "https://github.com/getsentry/sentry/pull/100#discussion_r10",
                "path": "src/components/Button.tsx",
                "line": 25,
                "body": "Consider using a const here",
                "user": {
                    "login": "reviewer1",
                    "id": 789,
                    "node_id": "U_test789",
                    "avatar_url": "https://avatars.githubusercontent.com/u/789",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/reviewer1",
                    "html_url": "https://github.com/reviewer1",
                    "followers_url": "https://api.github.com/users/reviewer1/followers",
                    "following_url": "https://api.github.com/users/reviewer1/following{/other_user}",
                    "gists_url": "https://api.github.com/users/reviewer1/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/reviewer1/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/reviewer1/subscriptions",
                    "organizations_url": "https://api.github.com/users/reviewer1/orgs",
                    "repos_url": "https://api.github.com/users/reviewer1/repos",
                    "events_url": "https://api.github.com/users/reviewer1/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/reviewer1/received_events",
                    "type": "User",
                    "site_admin": False,
                },
                "created_at": "2023-01-01T14:00:00Z",
                "updated_at": "2023-01-01T14:00:00Z",
                "author_association": "MEMBER",
                "commit_id": "abc123def456789",
                "original_commit_id": "abc123def456789",
                "diff_hunk": "@@ -20,6 +20,8 @@ function Button() {",
                "pull_request_url": "https://api.github.com/repos/getsentry/sentry/pulls/100",
                "pull_request_review_id": 1,
                "_links": {
                    "self": {
                        "href": "https://api.github.com/repos/getsentry/sentry/pulls/comments/10"
                    },
                    "html": {"href": "https://github.com/getsentry/sentry/pull/100#discussion_r10"},
                    "pull_request": {
                        "href": "https://api.github.com/repos/getsentry/sentry/pulls/100"
                    },
                },
            },
            {
                "id": 11,
                "node_id": "RC_test11",
                "url": "https://api.github.com/repos/getsentry/sentry/pulls/comments/11",
                "html_url": "https://github.com/getsentry/sentry/pull/100#discussion_r11",
                "path": "src/components/Button.tsx",
                "line": 30,
                "body": "Good catch!",
                "user": {
                    "login": "reviewer2",
                    "id": 101,
                    "node_id": "U_test101",
                    "avatar_url": "https://avatars.githubusercontent.com/u/101",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/reviewer2",
                    "html_url": "https://github.com/reviewer2",
                    "followers_url": "https://api.github.com/users/reviewer2/followers",
                    "following_url": "https://api.github.com/users/reviewer2/following{/other_user}",
                    "gists_url": "https://api.github.com/users/reviewer2/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/reviewer2/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/reviewer2/subscriptions",
                    "organizations_url": "https://api.github.com/users/reviewer2/orgs",
                    "repos_url": "https://api.github.com/users/reviewer2/repos",
                    "events_url": "https://api.github.com/users/reviewer2/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/reviewer2/received_events",
                    "type": "User",
                    "site_admin": False,
                },
                "created_at": "2023-01-01T15:00:00Z",
                "updated_at": "2023-01-01T15:00:00Z",
                "author_association": "CONTRIBUTOR",
                "commit_id": "abc123def456789",
                "original_commit_id": "abc123def456789",
                "diff_hunk": "@@ -25,6 +25,8 @@ function Button() {",
                "pull_request_url": "https://api.github.com/repos/getsentry/sentry/pulls/100",
                "pull_request_review_id": 1,
                "_links": {
                    "self": {
                        "href": "https://api.github.com/repos/getsentry/sentry/pulls/comments/11"
                    },
                    "html": {"href": "https://github.com/getsentry/sentry/pull/100#discussion_r11"},
                    "pull_request": {
                        "href": "https://api.github.com/repos/getsentry/sentry/pulls/100"
                    },
                },
            },
            {
                "id": 12,
                "node_id": "RC_test12",
                "url": "https://api.github.com/repos/getsentry/sentry/pulls/comments/12",
                "html_url": "https://github.com/getsentry/sentry/pull/100#discussion_r12",
                "path": "src/utils/helper.ts",
                "line": 10,
                "body": "This could be simplified",
                "user": {
                    "login": "reviewer1",
                    "id": 789,
                    "node_id": "U_test789",
                    "avatar_url": "https://avatars.githubusercontent.com/u/789",
                    "gravatar_id": "",
                    "url": "https://api.github.com/users/reviewer1",
                    "html_url": "https://github.com/reviewer1",
                    "followers_url": "https://api.github.com/users/reviewer1/followers",
                    "following_url": "https://api.github.com/users/reviewer1/following{/other_user}",
                    "gists_url": "https://api.github.com/users/reviewer1/gists{/gist_id}",
                    "starred_url": "https://api.github.com/users/reviewer1/starred{/owner}{/repo}",
                    "subscriptions_url": "https://api.github.com/users/reviewer1/subscriptions",
                    "organizations_url": "https://api.github.com/users/reviewer1/orgs",
                    "repos_url": "https://api.github.com/users/reviewer1/repos",
                    "events_url": "https://api.github.com/users/reviewer1/events{/privacy}",
                    "received_events_url": "https://api.github.com/users/reviewer1/received_events",
                    "type": "User",
                    "site_admin": False,
                },
                "created_at": "2023-01-02T09:00:00Z",
                "updated_at": "2023-01-02T09:00:00Z",
                "author_association": "MEMBER",
                "commit_id": "abc123def456789",
                "original_commit_id": "abc123def456789",
                "diff_hunk": "@@ -8,6 +8,8 @@ function helper() {",
                "pull_request_url": "https://api.github.com/repos/getsentry/sentry/pulls/100",
                "pull_request_review_id": 2,
                "_links": {
                    "self": {
                        "href": "https://api.github.com/repos/getsentry/sentry/pulls/comments/12"
                    },
                    "html": {"href": "https://github.com/getsentry/sentry/pull/100#discussion_r12"},
                    "pull_request": {
                        "href": "https://api.github.com/repos/getsentry/sentry/pulls/100"
                    },
                },
            },
        ]

    def _make_request(self, repo_name="getsentry/sentry", pr_number="100"):
        """Helper to make API request."""
        request = self.factory.get("/")
        request.user = self.user
        endpoint = OrganizationPrCommentsEndpoint()
        return endpoint.get(
            request=request,
            organization=self.organization,
            repo_name=repo_name,
            pr_number=pr_number,
        )

    @with_feature("organizations:pr-page")
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
    @patch("sentry.integrations.github.client.GitHubApiClient.get")
    def test_github_api_error(self, mock_get):
        """Test GitHub API error handling."""
        # Simulate GitHub API error
        mock_get.side_effect = ApiError("API rate limit exceeded")

        response = self._make_request()

        assert response.status_code == 502
        assert response.data["error"] == "api_error"
        assert "Failed to fetch pull request comments from GitHub" in response.data["message"]

    @with_feature("organizations:pr-page")
    def test_repository_not_found(self):
        """Test when repository doesn't exist in the database."""
        response = self._make_request(repo_name="does-not/exist")

        assert response.status_code == 404
        assert response.data["error"] == "integration_not_found"
        assert "No GitHub integration found" in response.data["message"]

    @with_feature("organizations:pr-page")
    @patch("sentry.integrations.github.client.GitHubApiClient.get")
    def test_unexpected_error(self, mock_get):
        """Test handling of unexpected errors."""
        # Simulate unexpected error (not ApiError)
        mock_get.side_effect = ValueError("Unexpected error")

        response = self._make_request()

        assert response.status_code == 500
        assert response.data["error"] == "internal_error"
        assert "An unexpected error occurred" in response.data["message"]
