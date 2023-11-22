from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationIntegrationReposTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.integration = self.create_integration(
            organization=self.org, provider="github", name="Example", external_id="github:1"
        )
        self.path = (
            f"/api/0/organizations/{self.org.slug}/integrations/{self.integration.id}/repos/"
        )

    @patch("sentry.integrations.github.GitHubAppsClient.get_repositories", return_value=[])
    def test_simple(self, get_repositories):
        get_repositories.return_value = [
            {"name": "rad-repo", "full_name": "Example/rad-repo", "default_branch": "main"},
            {"name": "cool-repo", "full_name": "Example/cool-repo"},
        ]
        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "repos": [
                {"name": "rad-repo", "identifier": "Example/rad-repo", "defaultBranch": "main"},
                {
                    "name": "cool-repo",
                    "identifier": "Example/cool-repo",
                    "defaultBranch": None,
                },
            ],
            "searchable": True,
        }

    @patch("sentry.integrations.github.GitHubAppsClient.get_repositories", return_value=[])
    def test_hide_hidden_repos(self, get_repositories):
        get_repositories.return_value = [
            {
                "name": "rad-repo",
                "full_name": "Example/rad-repo",
                "default_branch": "main",
            },
            {"name": "cool-repo", "full_name": "Example/cool-repo"},
        ]

        self.create_repo(
            project=self.project,
            integration_id=self.integration.id,
            name="Example/rad-repo",
        )

        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "repos": [
                {
                    "name": "cool-repo",
                    "identifier": "Example/cool-repo",
                    "defaultBranch": None,
                },
            ],
            "searchable": True,
        }

    def test_no_repository_method(self):
        integration = self.create_integration(
            organization=self.org, provider="jira", name="Example", external_id="example:1"
        )
        path = f"/api/0/organizations/{self.org.slug}/integrations/{integration.id}/repos/"
        response = self.client.get(path, format="json")

        assert response.status_code == 400
