from unittest.mock import Mock, patch

import orjson

from sentry.testutils.cases import APITestCase


class OrganizationPreventGitHubReposTest(APITestCase):
    endpoint = "sentry-api-0-organization-prevent-github-repos"
    method = "get"

    def setUp(self):
        self.organization = self.create_organization()
        self.user = self.create_user()
        self.create_member(organization=self.organization, user=self.user)

    def test_get_prevent_github_repos_empty(self):
        """Test that the endpoint returns empty orgRepos when no GitHub integrations exist"""
        self.login_as(user=self.user)

        response = self.get_success_response(self.organization.slug)

        assert response.data == {"orgRepos": []}

    @patch("sentry.prevent.endpoints.organization_github_repos.make_signed_seer_api_request")
    def test_get_prevent_github_repos_with_integration(self, mock_make_seer_request):
        """Test that the endpoint returns GitHub org data when integrations exist"""
        self.login_as(user=self.user)

        # Mock the Seer API response (empty response since we're just testing Sentry integration)
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {"integrated_repos": {"test-github-org": ["test-repo"]}}
        mock_make_seer_request.return_value = mock_response

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

        response = self.get_success_response(self.organization.slug)

        assert len(response.data["orgRepos"]) == 1

        github_org = response.data["orgRepos"][0]
        assert github_org["githubOrganizationId"] == "987654"
        assert github_org["name"] == "test-github-org"
        assert len(github_org["repos"]) == 1

        repo_data = github_org["repos"][0]
        assert repo_data["name"] == "test-repo"
        assert repo_data["fullName"] == "test-github-org/test-repo"
        assert repo_data["id"] == "111222"

    @patch("sentry.prevent.endpoints.organization_github_repos.make_signed_seer_api_request")
    def test_get_prevent_github_repos_with_seer_integration(self, mock_make_seer_request):
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

        # Mock the Seer API response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "integrated_repos": {
                "test-org": [
                    "sentry-repo",  # This exists in Sentry (matches "test-org/sentry-repo")
                    "seer-only-repo",  # This only exists in Seer
                ]
            }
        }
        mock_make_seer_request.return_value = mock_response

        response = self.get_success_response(self.organization.slug)

        assert len(response.data["orgRepos"]) == 1

        github_org = response.data["orgRepos"][0]
        assert github_org["githubOrganizationId"] == "987654"
        assert github_org["name"] == "test-org"
        assert len(github_org["repos"]) == 1
        assert "seer-only-repo" not in {repo["name"] for repo in github_org["repos"]}

        # Verify the Seer API was called correctly
        mock_make_seer_request.assert_called_once()
        call_args = mock_make_seer_request.call_args

        request_body = orjson.loads(call_args[1]["body"])
        assert request_body["organization_names"] == ["test-org"]
        assert request_body["provider"] == "github"

    @patch("sentry.prevent.endpoints.organization_github_repos.make_signed_seer_api_request")
    def test_get_prevent_github_repos_multiple_orgs(self, mock_make_seer_request):
        """Test that multiple GitHub orgs are handled"""
        self.login_as(user=self.user)

        # Mock empty Seer response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "integrated_repos": {
                "github-org-1": ["repo1"],
                "github-org-2": ["repo2"],
            }
        }
        mock_make_seer_request.return_value = mock_response

        # Create two GitHub integrations
        integration1 = self.create_integration(
            organization=self.organization,
            provider="github",
            name="github-org-1",
            external_id="123456",
            metadata={"account_id": "987654"},
        )

        integration2 = self.create_integration(
            organization=self.organization,
            provider="github",
            name="github-org-2",
            external_id="789012",
            metadata={"account_id": "345678"},
        )

        # Create projects and repos for both integrations
        project = self.create_project(organization=self.organization)

        self.create_repo(
            project=project,
            name="github-org-1/repo1",
            provider="integrations:github",
            integration_id=integration1.id,
            external_id="111",
        )

        self.create_repo(
            project=project,
            name="github-org-2/repo2",
            provider="integrations:github",
            integration_id=integration2.id,
            external_id="222",
        )

        response = self.get_success_response(self.organization.slug)

        # Should return both GitHub orgs
        assert len(response.data["orgRepos"]) == 2

        # Verify both orgs have their respective repos
        orgs_by_name = {org["name"]: org for org in response.data["orgRepos"]}

        assert "github-org-1" in orgs_by_name
        assert len(orgs_by_name["github-org-1"]["repos"]) == 1
        assert orgs_by_name["github-org-1"]["repos"][0]["name"] == "repo1"
        assert orgs_by_name["github-org-1"]["repos"][0]["id"] == "111"

        assert "github-org-2" in orgs_by_name
        assert len(orgs_by_name["github-org-2"]["repos"]) == 1
        assert orgs_by_name["github-org-2"]["repos"][0]["name"] == "repo2"
        assert orgs_by_name["github-org-2"]["repos"][0]["id"] == "222"

    @patch("sentry.prevent.endpoints.organization_github_repos.make_signed_seer_api_request")
    def test_get_prevent_github_repos_multiple_repos_same_org(self, mock_make_seer_request):
        """Test that multiple repositories for the same GitHub organization are all returned"""
        self.login_as(user=self.user)

        # Mock empty Seer response
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "integrated_repos": {"github-org": ["repo1", "repo2", "repo3"]}
        }
        mock_make_seer_request.return_value = mock_response

        # Create one GitHub integration
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="github-org",
            external_id="123456",
            metadata={"account_id": "987654"},
        )

        # Create a project and multiple repos for the same integration
        project = self.create_project(organization=self.organization)

        self.create_repo(
            project=project,
            name="github-org/repo1",
            provider="integrations:github",
            integration_id=integration.id,
            external_id="111",
        )

        self.create_repo(
            project=project,
            name="github-org/repo2",
            provider="integrations:github",
            integration_id=integration.id,
            external_id="222",
        )

        self.create_repo(
            project=project,
            name="github-org/repo3",
            provider="integrations:github",
            integration_id=integration.id,
            external_id="333",
        )

        response = self.get_success_response(self.organization.slug)

        # Should return one GitHub org with three repos
        assert len(response.data["orgRepos"]) == 1

        github_org = response.data["orgRepos"][0]
        assert github_org["name"] == "github-org"
        assert len(github_org["repos"]) == 3

        # Verify all three repos are present
        repo_names = {repo["name"] for repo in github_org["repos"]}
        assert repo_names == {"repo1", "repo2", "repo3"}

    @patch("sentry.prevent.endpoints.organization_github_repos.make_signed_seer_api_request")
    def test_get_prevent_github_repos_seer_error(self, mock_make_seer_request):
        """Test that the endpoint gracefully handles Seer API errors"""
        self.login_as(user=self.user)

        # Mock Seer API returning an error
        mock_response = Mock()
        mock_response.status = 500
        mock_make_seer_request.return_value = mock_response

        # Create a GitHub integration and repo
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-github-org",
            external_id="123456",
            metadata={"account_id": "987654"},
        )

        project = self.create_project(organization=self.organization)
        self.create_repo(
            project=project,
            name="test-github-org/test-repo",
            provider="integrations:github",
            integration_id=integration.id,
            external_id="111222",
        )

        # Should return no repos since Seer failed
        response = self.get_success_response(self.organization.slug)
        assert response.data == {"orgRepos": []}
