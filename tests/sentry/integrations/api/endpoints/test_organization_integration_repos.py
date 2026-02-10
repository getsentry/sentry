from unittest.mock import MagicMock, patch

from sentry.testutils.cases import APITestCase


class OrganizationIntegrationReposTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.project = self.create_project(organization=self.org)
        self.integration = self.create_integration(
            organization=self.org, provider="github", name="Example", external_id="github:1"
        )
        self.path = (
            f"/api/0/organizations/{self.org.slug}/integrations/{self.integration.id}/repos/"
        )

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_simple(self, get_repositories: MagicMock) -> None:
        get_repositories.return_value = [
            {"name": "rad-repo", "identifier": "Example/rad-repo", "default_branch": "main"},
            {"name": "cool-repo", "identifier": "Example/cool-repo"},
        ]
        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "repos": [
                {
                    "name": "rad-repo",
                    "identifier": "Example/rad-repo",
                    "defaultBranch": "main",
                    "isInstalled": False,
                },
                {
                    "name": "cool-repo",
                    "identifier": "Example/cool-repo",
                    "defaultBranch": None,
                    "isInstalled": False,
                },
            ],
            "searchable": True,
        }

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_hide_hidden_repos(self, get_repositories: MagicMock) -> None:
        get_repositories.return_value = [
            {
                "name": "rad-repo",
                "identifier": "Example/rad-repo",
                "default_branch": "main",
            },
            {"name": "cool-repo", "identifier": "Example/cool-repo"},
        ]

        self.create_repo(
            project=self.project,
            integration_id=self.integration.id,
            name="Example/rad-repo",
        )

        response = self.client.get(self.path, format="json", data={"installableOnly": "true"})

        assert response.status_code == 200, response.content
        assert response.data == {
            "repos": [
                {
                    "name": "cool-repo",
                    "identifier": "Example/cool-repo",
                    "defaultBranch": None,
                    "isInstalled": False,
                },
            ],
            "searchable": True,
        }

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_installable_only(self, get_repositories: MagicMock) -> None:
        get_repositories.return_value = [
            {"name": "rad-repo", "identifier": "Example/rad-repo", "default_branch": "main"},
            {"name": "cool-repo", "identifier": "Example/cool-repo", "default_branch": "dev"},
            {"name": "awesome-repo", "identifier": "Example/awesome-repo"},
        ]

        self.create_repo(
            project=self.project,
            integration_id=self.integration.id,
            name="Example/rad-repo",
        )

        response = self.client.get(self.path, format="json", data={"installableOnly": "true"})
        assert response.status_code == 200, response.content
        assert response.data == {
            "repos": [
                {
                    "name": "cool-repo",
                    "identifier": "Example/cool-repo",
                    "defaultBranch": "dev",
                    "isInstalled": False,
                },
                {
                    "name": "awesome-repo",
                    "identifier": "Example/awesome-repo",
                    "defaultBranch": None,
                    "isInstalled": False,
                },
            ],
            "searchable": True,
        }

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_is_installed_field(self, get_repositories: MagicMock) -> None:
        get_repositories.return_value = [
            {"name": "rad-repo", "identifier": "Example/rad-repo", "default_branch": "main"},
            {"name": "rad-repo", "identifier": "Example2/rad-repo", "default_branch": "dev"},
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
                    "name": "rad-repo",
                    "identifier": "Example/rad-repo",
                    "defaultBranch": "main",
                    "isInstalled": True,
                },
                {
                    "name": "rad-repo",
                    "identifier": "Example2/rad-repo",
                    "defaultBranch": "dev",
                    "isInstalled": False,
                },
            ],
            "searchable": True,
        }

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_repo_installed_by_other_org_not_excluded(self, get_repositories: MagicMock) -> None:
        """
        When two organizations share the same integration, a repo installed by
        one organization should not affect the available repos for the other.
        """
        get_repositories.return_value = [
            {"name": "shared-repo", "identifier": "Example/shared-repo", "default_branch": "main"},
        ]

        other_org = self.create_organization(owner=self.user, name="other-org")
        other_project = self.create_project(organization=other_org)
        self.create_repo(
            project=other_project,
            integration_id=self.integration.id,
            name="Example/shared-repo",
        )

        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "repos": [
                {
                    "name": "shared-repo",
                    "identifier": "Example/shared-repo",
                    "defaultBranch": "main",
                    "isInstalled": False,
                },
            ],
            "searchable": True,
        }

    def test_no_repository_method(self) -> None:
        integration = self.create_integration(
            organization=self.org, provider="jira", name="Example", external_id="example:1"
        )
        path = f"/api/0/organizations/{self.org.slug}/integrations/{integration.id}/repos/"
        response = self.client.get(path, format="json")

        assert response.status_code == 400
