from unittest import mock

from django.urls import reverse

from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.testutils.cases import APITestCase


class OrganizationCodeMappingsBulkTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.team = self.create_team(
            organization=self.organization, name="Mariachi Band", members=[self.user]
        )
        self.project1 = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        self.repo1 = self.create_repo(
            project=self.project1,
            name="getsentry/sentry-android",
            integration_id=self.integration.id,
        )
        self.url = reverse(
            "sentry-api-0-organization-code-mappings-bulk",
            args=[self.organization.slug],
        )

    def make_post(self, data=None, **kwargs):
        payload = {
            "project": self.project1.slug,
            "repository": self.repo1.name,
            "defaultBranch": "main",
            "mappings": [
                {
                    "stackRoot": "com/example/maps",
                    "sourceRoot": "modules/maps/src/main/java/com/example/maps",
                },
            ],
        }
        if data:
            payload.update(data)
        return self.client.post(self.url, data=payload, format="json", **kwargs)

    def test_create_single_mapping(self) -> None:
        response = self.make_post()
        assert response.status_code == 200, response.content
        assert response.data["created"] == 1
        assert response.data["updated"] == 0
        assert response.data["errors"] == 0
        assert len(response.data["mappings"]) == 1
        assert response.data["mappings"][0]["status"] == "created"

        config = RepositoryProjectPathConfig.objects.get(
            project=self.project1, stack_root="com/example/maps"
        )
        assert config.source_root == "modules/maps/src/main/java/com/example/maps"
        assert config.default_branch == "main"
        assert config.repository == self.repo1
        assert config.organization_id == self.organization.id
        assert config.automatically_generated is False

    def test_create_multiple_mappings(self) -> None:
        response = self.make_post(
            {
                "mappings": [
                    {
                        "stackRoot": "com/example/maps",
                        "sourceRoot": "modules/maps/src/main/java/com/example/maps",
                    },
                    {
                        "stackRoot": "com/example/auth",
                        "sourceRoot": "modules/auth/src/main/java/com/example/auth",
                    },
                    {
                        "stackRoot": "com/example/core",
                        "sourceRoot": "modules/core/src/main/java/com/example/core",
                    },
                ],
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["created"] == 3
        assert response.data["updated"] == 0
        assert RepositoryProjectPathConfig.objects.filter(project=self.project1).count() == 3

    def test_update_existing_mapping(self) -> None:
        self.create_code_mapping(
            project=self.project1,
            repo=self.repo1,
            stack_root="com/example/maps",
            source_root="old/source/root",
        )

        response = self.make_post(
            {
                "mappings": [
                    {
                        "stackRoot": "com/example/maps",
                        "sourceRoot": "modules/maps/src/main/java/com/example/maps",
                    },
                ],
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["created"] == 0
        assert response.data["updated"] == 1

        config = RepositoryProjectPathConfig.objects.get(
            project=self.project1, stack_root="com/example/maps"
        )
        assert config.source_root == "modules/maps/src/main/java/com/example/maps"

    def test_mixed_create_and_update(self) -> None:
        self.create_code_mapping(
            project=self.project1,
            repo=self.repo1,
            stack_root="com/example/existing",
            source_root="old/path",
        )

        response = self.make_post(
            {
                "mappings": [
                    {
                        "stackRoot": "com/example/existing",
                        "sourceRoot": "new/path",
                    },
                    {
                        "stackRoot": "com/example/new",
                        "sourceRoot": "brand/new/path",
                    },
                ],
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["created"] == 1
        assert response.data["updated"] == 1

    def test_empty_roots_allowed(self) -> None:
        response = self.make_post(
            {
                "mappings": [
                    {
                        "stackRoot": "",
                        "sourceRoot": "",
                    },
                ],
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["created"] == 1

    def test_missing_project(self) -> None:
        response = self.make_post({"project": None})
        assert response.status_code == 400

    def test_missing_repository(self) -> None:
        response = self.make_post({"repository": None})
        assert response.status_code == 400

    def test_missing_mappings(self) -> None:
        response = self.make_post({"mappings": None})
        assert response.status_code == 400

    def test_empty_mappings_list(self) -> None:
        response = self.make_post({"mappings": []})
        assert response.status_code == 400
        assert "At least one mapping" in str(response.data)

    def test_too_many_mappings(self) -> None:
        mappings = [
            {"stackRoot": f"com/example/mod{i}", "sourceRoot": f"modules/mod{i}/src"}
            for i in range(301)
        ]
        response = self.make_post({"mappings": mappings})
        assert response.status_code == 400
        assert "maximum of 300" in str(response.data)

    def test_invalid_stack_root_with_spaces(self) -> None:
        response = self.make_post(
            {
                "mappings": [
                    {"stackRoot": "has space", "sourceRoot": "valid/path"},
                ],
            }
        )
        assert response.status_code == 400

    def test_invalid_source_root_with_quotes(self) -> None:
        response = self.make_post(
            {
                "mappings": [
                    {"stackRoot": "valid/path", "sourceRoot": "has'quote"},
                ],
            }
        )
        assert response.status_code == 400

    def test_invalid_branch_name(self) -> None:
        response = self.make_post({"defaultBranch": "/leading-slash"})
        assert response.status_code == 400

    def test_trailing_slash_in_branch(self) -> None:
        response = self.make_post({"defaultBranch": "trailing-slash/"})
        assert response.status_code == 400

    def test_valid_branch_with_slashes(self) -> None:
        response = self.make_post({"defaultBranch": "prod/deploy-branch"})
        assert response.status_code == 200, response.content

    def test_valid_branch_with_periods(self) -> None:
        response = self.make_post({"defaultBranch": "release-2.0.0"})
        assert response.status_code == 200, response.content

    def test_unknown_project_slug(self) -> None:
        response = self.make_post({"project": "nonexistent-project"})
        assert response.status_code == 404
        assert "Project not found" in response.data["detail"]

    def test_unknown_repository_name(self) -> None:
        response = self.make_post({"repository": "nonexistent/repo"})
        assert response.status_code == 404
        assert "Repository not found" in response.data["detail"]

    def test_repository_without_integration(self) -> None:
        repo_no_integration = self.create_repo(
            project=self.project1,
            name="standalone/repo",
            integration_id=None,
        )
        response = self.make_post({"repository": repo_no_integration.name})
        assert response.status_code == 400
        assert "not associated with an integration" in response.data["detail"]

    def test_blank_default_branch_triggers_inference(self) -> None:
        with mock.patch(
            "sentry.integrations.source_code_management.repository."
            "RepositoryIntegration.get_repository_default_branch",
            return_value=None,
        ):
            response = self.make_post({"defaultBranch": ""})
        assert response.status_code == 400
        assert "Could not determine the default branch" in response.data["detail"]

    def test_missing_default_branch_inferred_from_integration(self) -> None:
        with mock.patch(
            "sentry.integrations.source_code_management.repository."
            "RepositoryIntegration.get_repository_default_branch",
            return_value="develop",
        ):
            payload = {
                "project": self.project1.slug,
                "repository": self.repo1.name,
                "mappings": [
                    {"stackRoot": "com/example/a", "sourceRoot": "modules/a/src"},
                ],
            }
            response = self.client.post(self.url, data=payload, format="json")
        assert response.status_code == 200, response.content
        config = RepositoryProjectPathConfig.objects.get(
            project=self.project1, stack_root="com/example/a"
        )
        assert config.default_branch == "develop"

    def test_missing_default_branch_inference_fails(self) -> None:
        with mock.patch(
            "sentry.integrations.source_code_management.repository."
            "RepositoryIntegration.get_repository_default_branch",
            return_value=None,
        ):
            payload = {
                "project": self.project1.slug,
                "repository": self.repo1.name,
                "mappings": [
                    {"stackRoot": "com/example/a", "sourceRoot": "modules/a/src"},
                ],
            }
            response = self.client.post(self.url, data=payload, format="json")
        assert response.status_code == 400
        assert "Could not determine the default branch" in response.data["detail"]

    def test_process_resource_change_fires_once_after_batch(self) -> None:
        with mock.patch(
            "sentry.integrations.api.endpoints.organization_code_mappings_bulk.process_resource_change"
        ) as mock_prc:
            response = self.make_post(
                {
                    "mappings": [
                        {"stackRoot": "com/example/a", "sourceRoot": "modules/a/src"},
                        {"stackRoot": "com/example/b", "sourceRoot": "modules/b/src"},
                        {"stackRoot": "com/example/c", "sourceRoot": "modules/c/src"},
                    ],
                }
            )
        assert response.status_code == 200, response.content
        assert mock_prc.call_count == 1
        instance = mock_prc.call_args[0][0]
        assert instance._skip_post_save is False

    def test_provider_disambiguates_duplicate_repos(self) -> None:
        # Give repo1 a provider so we can filter on it
        self.repo1.provider = "integrations:github"
        self.repo1.save()
        # Create a second repo with the same name but different provider
        self.create_repo(
            project=self.project1,
            name=self.repo1.name,
            provider="integrations:gitlab",
            integration_id=self.integration.id,
        )
        # Without provider, should get 409
        response = self.make_post()
        assert response.status_code == 409
        assert "Multiple repositories" in response.data["detail"]

        # With provider, should resolve to the correct repo
        response = self.make_post({"provider": "github"})
        assert response.status_code == 200, response.content

    def test_duplicate_stack_root_in_request_last_wins(self) -> None:
        response = self.make_post(
            {
                "mappings": [
                    {"stackRoot": "com/example/dup", "sourceRoot": "first/path"},
                    {"stackRoot": "com/example/dup", "sourceRoot": "second/path"},
                ],
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["created"] == 1
        assert response.data["updated"] == 1

        config = RepositoryProjectPathConfig.objects.get(
            project=self.project1, stack_root="com/example/dup"
        )
        assert config.source_root == "second/path"

    def test_skip_post_save_does_not_leak_to_fetched_instances(self) -> None:
        self.make_post()
        config = RepositoryProjectPathConfig.objects.get(
            project=self.project1, stack_root="com/example/maps"
        )
        assert config._skip_post_save is False
