from unittest.mock import patch

from sentry.testutils.cases import APITestCase


class OrganizationPreventGitHubReposTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.user = self.create_user()
        self.create_member(organization=self.organization, user=self.user)

    def test_get_prevent_github_repos_empty(self):
        """Test that the endpoint returns empty orgRepos when no GitHub integrations exist"""
        self.login_as(user=self.user)

        url = f"/api/0/organizations/{self.organization.slug}/prevent/github/repos/"
        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data == {"orgRepos": []}

    def test_get_prevent_github_repos_with_integration(self):
        """Test that the endpoint returns GitHub org data when integrations exist"""
        self.login_as(user=self.user)

        # Create a GitHub integration
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-github-org",
            external_id="123456",
            metadata={
                "account_id": "987654",
                "icon": "https://avatars.githubusercontent.com/u/123456",
                "domain_name": "github.com/test-github-org",
            },
        )

        # Create a project for the repository
        project = self.create_project(organization=self.organization)

        # Create a repository linked to this integration
        self.create_repo(
            project=project,
            name="test-github-org/test-repo",
            provider="integrations:github",
            integration_id=integration.id,
            external_id="111222",
        )

        url = f"/api/0/organizations/{self.organization.slug}/prevent/github/repos/"
        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data["orgRepos"]) == 1

        github_org = response.data["orgRepos"][0]
        assert github_org["githubOrganizationId"] == "987654"
        assert github_org["name"] == "test-github-org"
        assert len(github_org["repos"]) == 1

        repo_data = github_org["repos"][0]
        assert repo_data["name"] == "test-repo"
        assert repo_data["fullName"] == "test-github-org/test-repo"
        assert repo_data["hasGhAppSentryIo"] is True
        assert repo_data["hasGhAppSeerBySentry"] is False
        assert "id" not in repo_data  # Verify id is not in response

    def test_get_prevent_github_repos_requires_auth(self):
        """Test that the endpoint requires authentication"""
        url = f"/api/0/organizations/{self.organization.slug}/prevent/github/repos/"
        response = self.client.get(url)

        assert response.status_code == 401

    def test_get_prevent_github_repos_requires_org_membership(self):
        """Test that the endpoint requires organization membership"""
        other_user = self.create_user()
        self.login_as(user=other_user)

        url = f"/api/0/organizations/{self.organization.slug}/prevent/github/repos/"
        response = self.client.get(url)

        assert response.status_code == 403

    @patch(
        "sentry.api.endpoints.organization_prevent_github_repos.OrganizationPreventGitHubReposEndpoint._fetch_seer_integrated_repos"
    )
    def test_get_prevent_github_repos_with_seer_integration(self, mock_fetch_seer):
        """Test that repos from both Sentry and Seer are merged correctly"""
        self.login_as(user=self.user)

        # Create a GitHub integration
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-org",
            external_id="123456",
            metadata={
                "account_id": "987654",
                "icon": "https://avatars.githubusercontent.com/u/123456",
                "domain_name": "github.com/test-org",
            },
        )

        # Create a project and repository in Sentry
        project = self.create_project(organization=self.organization)
        self.create_repo(
            project=project,
            name="test-org/sentry-repo",
            provider="integrations:github",
            integration_id=integration.id,
            external_id="111222",
        )

        # Mock Seer API to return repos (just repo names, not full paths)
        mock_fetch_seer.return_value = {
            "test-org": [
                "sentry-repo",  # This exists in Sentry (matches "test-org/sentry-repo")
                "seer-only-repo",  # This only exists in Seer
            ]
        }

        url = f"/api/0/organizations/{self.organization.slug}/prevent/github/repos/"
        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data["orgRepos"]) == 1

        github_org = response.data["orgRepos"][0]
        assert github_org["githubOrganizationId"] == "987654"
        assert github_org["name"] == "test-org"
        assert len(github_org["repos"]) == 2

        # Find repos by fullName
        repos_by_name = {r["fullName"]: r for r in github_org["repos"]}

        # Repo that exists in both Sentry and Seer
        sentry_repo_data = repos_by_name["test-org/sentry-repo"]
        assert sentry_repo_data["name"] == "sentry-repo"
        assert sentry_repo_data["hasGhAppSentryIo"] is True
        assert sentry_repo_data["hasGhAppSeerBySentry"] is True

        # Repo that only exists in Seer
        seer_only_repo_data = repos_by_name["test-org/seer-only-repo"]
        assert seer_only_repo_data["name"] == "seer-only-repo"
        assert seer_only_repo_data["hasGhAppSentryIo"] is False
        assert seer_only_repo_data["hasGhAppSeerBySentry"] is True
