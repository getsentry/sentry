from typing import int
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

    def test_get_prevent_github_repos_multiple_orgs(self):
        """Test that multiple GitHub orgs are handled"""
        self.login_as(user=self.user)

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

    def test_get_prevent_github_repos_multiple_repos_same_org(self):
        """Test that multiple repositories for the same GitHub organization are all returned"""
        self.login_as(user=self.user)

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

    def test_get_prevent_github_repos_no_repos(self):
        """Test that the endpoint gracefully handles missing repos if integration exists but there are no repos"""
        self.login_as(user=self.user)

        # Create a GitHub integration but no repos
        self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-github-org",
            external_id="123456",
            metadata={"account_id": "987654"},
        )

        response = self.get_success_response(self.organization.slug)
        assert response.data == {"orgRepos": []}

    def test_get_prevent_github_repos_seer_integration_account_id_is_number(self):
        """Test that the endpoint returns the correct orgRepos when account_id is a number"""
        self.login_as(user=self.user)

        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="test-github-org",
            external_id="123456",
            metadata={"account_id": 987654},
        )

        project = self.create_project(organization=self.organization)
        self.create_repo(
            project=project,
            name="test-github-org/test-repo",
            provider="integrations:github",
            integration_id=integration.id,
            external_id="111222",
        )

        response = self.get_success_response(self.organization.slug)
        assert response.data == {
            "orgRepos": [
                {
                    "githubOrganizationId": "987654",
                    "name": "test-github-org",
                    "repos": [
                        {
                            "id": "111222",
                            "name": "test-repo",
                            "fullName": "test-github-org/test-repo",
                        }
                    ],
                }
            ]
        }
