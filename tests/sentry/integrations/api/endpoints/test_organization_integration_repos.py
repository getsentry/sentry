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
            {
                "name": "rad-repo",
                "identifier": "Example/rad-repo",
                "default_branch": "main",
                "external_id": "rad-repo",
            },
            {"name": "cool-repo", "identifier": "Example/cool-repo", "external_id": "cool-repo"},
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
                    "externalId": "rad-repo",
                },
                {
                    "name": "cool-repo",
                    "identifier": "Example/cool-repo",
                    "defaultBranch": None,
                    "isInstalled": False,
                    "externalId": "cool-repo",
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
                "external_id": "rad-repo",
            },
            {"name": "cool-repo", "identifier": "Example/cool-repo", "external_id": "cool-repo"},
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
                    "externalId": "cool-repo",
                },
            ],
            "searchable": True,
        }

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_installable_only(self, get_repositories: MagicMock) -> None:
        get_repositories.return_value = [
            {
                "name": "rad-repo",
                "identifier": "Example/rad-repo",
                "default_branch": "main",
                "external_id": "rad-repo",
            },
            {
                "name": "cool-repo",
                "identifier": "Example/cool-repo",
                "default_branch": "dev",
                "external_id": "cool-repo",
            },
            {
                "name": "awesome-repo",
                "identifier": "Example/awesome-repo",
                "external_id": "awesome-repo",
            },
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
                    "externalId": "cool-repo",
                },
                {
                    "name": "awesome-repo",
                    "identifier": "Example/awesome-repo",
                    "defaultBranch": None,
                    "isInstalled": False,
                    "externalId": "awesome-repo",
                },
            ],
            "searchable": True,
        }

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_is_installed_field(self, get_repositories: MagicMock) -> None:
        get_repositories.return_value = [
            {
                "name": "rad-repo",
                "identifier": "Example/rad-repo",
                "default_branch": "main",
                "external_id": "rad-repo",
            },
            {
                "name": "rad-repo",
                "identifier": "Example2/rad-repo",
                "default_branch": "dev",
                "external_id": "rad-repo",
            },
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
                    "externalId": "rad-repo",
                },
                {
                    "name": "rad-repo",
                    "identifier": "Example2/rad-repo",
                    "defaultBranch": "dev",
                    "externalId": "rad-repo",
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
            {
                "name": "shared-repo",
                "identifier": "Example/shared-repo",
                "default_branch": "main",
                "external_id": "shared-repo",
            },
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
                    "externalId": "shared-repo",
                },
            ],
            "searchable": True,
        }

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_accessible_only_passes_param(self, get_repositories: MagicMock) -> None:
        """When accessibleOnly=true, passes accessible_only to get_repositories."""
        get_repositories.return_value = [
            {
                "name": "rad-repo",
                "identifier": "Example/rad-repo",
                "default_branch": "main",
                "external_id": "rad-repo",
            },
        ]
        response = self.client.get(
            self.path, format="json", data={"search": "rad", "accessibleOnly": "true"}
        )

        assert response.status_code == 200, response.content
        get_repositories.assert_called_once_with("rad", accessible_only=True, use_cache=True)
        assert response.data == {
            "repos": [
                {
                    "name": "rad-repo",
                    "identifier": "Example/rad-repo",
                    "defaultBranch": "main",
                    "isInstalled": False,
                    "externalId": "rad-repo",
                },
            ],
            "searchable": True,
        }

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_accessible_only_without_search(self, get_repositories: MagicMock) -> None:
        """When accessibleOnly=true but no search, passes both params through."""
        get_repositories.return_value = [
            {
                "name": "rad-repo",
                "identifier": "Example/rad-repo",
                "default_branch": "main",
                "external_id": "rad-repo",
            },
        ]
        response = self.client.get(self.path, format="json", data={"accessibleOnly": "true"})

        assert response.status_code == 200, response.content
        get_repositories.assert_called_once_with(None, accessible_only=True, use_cache=False)

    @patch(
        "sentry.integrations.github.integration.GitHubIntegration.get_repositories", return_value=[]
    )
    def test_accessible_only_with_installable_only(self, get_repositories: MagicMock) -> None:
        """Both filters compose: accessible scopes the fetch, installable excludes installed repos."""
        get_repositories.return_value = [
            {
                "name": "rad-repo",
                "identifier": "Example/rad-repo",
                "default_branch": "main",
                "external_id": "rad-repo",
            },
            {
                "name": "cool-repo",
                "identifier": "Example/cool-repo",
                "default_branch": "dev",
                "external_id": "cool-repo",
            },
        ]

        self.create_repo(
            project=self.project,
            integration_id=self.integration.id,
            name="Example/rad-repo",
        )

        response = self.client.get(
            self.path,
            format="json",
            data={"search": "Example", "accessibleOnly": "true", "installableOnly": "true"},
        )

        assert response.status_code == 200, response.content
        get_repositories.assert_called_once_with("Example", accessible_only=True, use_cache=True)
        assert response.data == {
            "repos": [
                {
                    "name": "cool-repo",
                    "identifier": "Example/cool-repo",
                    "defaultBranch": "dev",
                    "isInstalled": False,
                    "externalId": "cool-repo",
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
