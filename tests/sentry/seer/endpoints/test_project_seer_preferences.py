from unittest.mock import MagicMock, patch

from django.urls import reverse

from sentry.models.repository import Repository
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.testutils.cases import APITestCase


class ProjectSeerPreferencesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-preferences"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="user@example.com")
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(teams=[self.team], organization=self.org)
        self.login_as(user=self.user)

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.org.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.repository = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="github",
            external_id="123456",
        )

    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[
            {
                "integration_id": "111",
                "provider": "github",
                "owner": "getsentry",
                "name": "sentry",
                "external_id": "123456",
            }
        ],
    )
    def test_get(self, mock_get_autofix_repos: MagicMock) -> None:
        """Test that the GET method reads the preference  and returns it alongside code-mapping repos."""
        self.create_seer_project_repository(project=self.project, repository=self.repository)

        response = self.client.get(self.url)

        assert response.status_code == 200
        preference = response.data["preference"]
        assert preference["project_id"] == self.project.id
        assert preference["organization_id"] == self.org.id
        assert len(preference["repositories"]) == 1
        assert preference["repositories"][0]["external_id"] == "123456"
        assert preference["repositories"][0]["name"] == "sentry"
        assert len(response.data["code_mapping_repos"]) == 1
        assert response.data["code_mapping_repos"][0]["external_id"] == "123456"
        assert response.data["code_mapping_repos"][0]["name"] == "sentry"

    def test_post(self) -> None:
        """Test that POST writes the preference to Sentry DB."""
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                    "branch_name": "main",
                    "instructions": "test instructions",
                }
            ]
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204

        seer_repos = list(
            SeerProjectRepository.objects.filter(
                project_repository__project=self.project
            ).select_related("project_repository__repository")
        )
        assert len(seer_repos) == 1
        assert seer_repos[0].project_repository.repository_id == self.repository.id
        assert seer_repos[0].branch_name == "main"
        assert seer_repos[0].instructions == "test instructions"

    def test_invalid_request_data(self) -> None:
        """Test handling of invalid request data"""
        # Request with invalid data (missing required fields)
        request_data = {
            "repositories": [
                {
                    # Missing required 'provider' and 'integration_id' fields
                    "owner": "getsentry",
                    "name": "sentry",
                }
            ]
        }

        response = self.client.post(self.url, data=request_data)

        # Should fail with a 400 error for invalid request data
        assert response.status_code == 400
        assert (
            SeerProjectRepository.objects.filter(project_repository__project=self.project).count()
            == 0
        )

    def test_post_accepts_repository_id_without_legacy_identity(self) -> None:
        response = self.client.post(
            self.url,
            data={"repositories": [{"repository_id": self.repository.id}]},
        )

        assert response.status_code == 204
        seer_repo = SeerProjectRepository.objects.get(project_repository__project=self.project)
        assert seer_repo.project_repository.repository_id == self.repository.id

    def test_post_repository_id_ignores_stale_legacy_identity(self) -> None:
        response = self.client.post(
            self.url,
            data={
                "repositories": [
                    {
                        "repository_id": self.repository.id,
                        "provider": "unsupported-provider",
                        "owner": "stale-owner",
                        "name": "stale-name",
                        "external_id": "stale-external-id",
                    }
                ]
            },
        )

        assert response.status_code == 204
        get_response = self.client.get(self.url)
        repo_data = get_response.data["preference"]["repositories"][0]
        assert repo_data["provider"] == self.repository.provider
        assert repo_data["owner"] == "getsentry"
        assert repo_data["name"] == "sentry"
        assert repo_data["external_id"] == self.repository.external_id

    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[],
    )
    def test_get_no_seer_project_repositories(self, mock_get_autofix_repos: MagicMock) -> None:
        """Test that GET method returns empty repositories when the project has no SeerProjectRepository rows."""
        response = self.client.get(self.url)

        assert response.status_code == 200
        preference = response.data["preference"]
        assert preference["project_id"] == self.project.id
        assert preference["repositories"] == []
        assert preference["automation_handoff"] is None
        assert response.data["code_mapping_repos"] == []

    def test_post_with_blank_string_fields(self) -> None:
        """Test that optional fields accept blank strings (empty strings) not just null values"""
        # Request data with blank strings for optional fields
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                    "branch_name": "",  # blank string
                    "instructions": "",  # blank string
                }
            ]
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        seer_repos = list(
            SeerProjectRepository.objects.filter(project_repository__project=self.project)
        )
        assert len(seer_repos) == 1
        assert seer_repos[0].branch_name == ""
        assert seer_repos[0].instructions == ""

    def test_post_with_automation_handoff(self) -> None:
        """Test that POST request correctly handles automation_handoff field"""
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": {
                "handoff_point": "root_cause",
                "target": "cursor_background_agent",
                "integration_id": 123,
            },
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        assert self.project.get_option("sentry:seer_automation_handoff_point") == "root_cause"
        assert (
            self.project.get_option("sentry:seer_automation_handoff_target")
            == "cursor_background_agent"
        )
        assert self.project.get_option("sentry:seer_automation_handoff_integration_id") == 123

    def test_post_with_null_automation_handoff(self) -> None:
        """Test that POST request correctly handles null automation_handoff"""
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 123)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": None,
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        # Automation handoff should be cleared.
        assert self.project.get_option("sentry:seer_automation_handoff_point") is None
        assert self.project.get_option("sentry:seer_automation_handoff_target") is None
        assert self.project.get_option("sentry:seer_automation_handoff_integration_id") is None

    def test_post_with_invalid_automation_handoff_target(self) -> None:
        """Test that POST request fails with invalid target value"""
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": {
                "handoff_point": "root_cause",
                "target": "invalid_target",
                "integration_id": 123,
            },
        }

        response = self.client.post(self.url, data=request_data)

        # Should fail with a 400 error for invalid request data
        assert response.status_code == 400
        assert (
            SeerProjectRepository.objects.filter(project_repository__project=self.project).count()
            == 0
        )

    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[],
    )
    def test_get_with_automation_handoff(self, mock_get_autofix_repos: MagicMock) -> None:
        """Test that GET method correctly returns automation_handoff."""
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 123)

        response = self.client.get(self.url)

        assert response.status_code == 200
        handoff = response.data["preference"]["automation_handoff"]
        assert handoff["handoff_point"] == "root_cause"
        assert handoff["target"] == "cursor_background_agent"
        assert handoff["integration_id"] == 123

    def test_post_with_auto_create_pr_in_handoff_config(self) -> None:
        """Test that POST request correctly handles auto_create_pr in automation_handoff"""
        # Request data with automation_handoff including auto_create_pr
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": {
                "handoff_point": "root_cause",
                "target": "cursor_background_agent",
                "integration_id": 123,
                "auto_create_pr": True,
            },
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is True

    @patch(
        "sentry.seer.endpoints.project_seer_preferences.get_autofix_repos_from_project_code_mappings",
        return_value=[],
    )
    def test_get_returns_auto_create_pr_in_handoff_config(
        self, mock_get_autofix_repos: MagicMock
    ) -> None:
        """Test that GET method correctly returns auto_create_pr in automation_handoff."""
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 123)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

        response = self.client.get(self.url)

        assert response.status_code == 200
        assert response.data["preference"]["automation_handoff"]["auto_create_pr"] is True

    def test_post_handoff_without_auto_create_pr_defaults_to_false(self) -> None:
        """Test that when auto_create_pr is not specified in handoff, it defaults to False"""
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
            "automation_handoff": {
                "handoff_point": "root_cause",
                "target": "cursor_background_agent",
                "integration_id": 123,
            },
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is False

    def test_post_validates_repository_exists_in_organization(self) -> None:
        """Test that POST validates repository exists in the organization"""
        repo = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="valid-external-id",
        )

        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "valid-external-id",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        seer_repos = list(
            SeerProjectRepository.objects.filter(project_repository__project=self.project)
        )
        assert len(seer_repos) == 1
        assert seer_repos[0].project_repository.repository_id == repo.id

    def test_post_rejects_repository_not_in_organization(self) -> None:
        """Test that POST fails when repository doesn't exist in the organization"""
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "nonexistent-repo-id",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        assert (
            SeerProjectRepository.objects.filter(project_repository__project=self.project).count()
            == 0
        )

    def test_post_rejects_repository_from_different_organization(self) -> None:
        """Test that POST fails when repository exists but belongs to a different organization"""
        other_org = self.create_organization(owner=self.user)
        Repository.objects.create(
            organization_id=other_org.id,
            name="other-org/repo",
            provider="integrations:github",
            external_id="other-org-repo-id",
        )

        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "integrations:github",
                    "owner": "other-org",
                    "name": "repo",
                    "external_id": "other-org-repo-id",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        assert (
            SeerProjectRepository.objects.filter(project_repository__project=self.project).count()
            == 0
        )

    def test_post_rejects_mismatched_organization_id_in_repository_data(self) -> None:
        """Test that POST fails when repository organization_id doesn't match project's org."""
        other_org = self.create_organization(owner=self.user)

        request_data = {
            "repositories": [
                {
                    "organization_id": other_org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        assert (
            SeerProjectRepository.objects.filter(project_repository__project=self.project).count()
            == 0
        )

    def test_post_rejects_repository_id_from_different_organization(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        other_repo = self.create_repo(
            project=other_project,
            name="other/repo",
            provider="integrations:github",
            external_id="other-external-id",
        )
        request_data = {
            "repositories": [
                {
                    "repository_id": other_repo.id,
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "other",
                    "name": "repo",
                    "external_id": "other-external-id",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        assert not SeerProjectRepository.objects.filter(
            project_repository__project=self.project
        ).exists()

    def test_post_canonicalizes_repo_name_and_owner(self) -> None:
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "injected-owner",
                    "name": "injected-name",
                    "external_id": "123456",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204

        get_response = self.client.get(self.url)
        repo_data = get_response.data["preference"]["repositories"][0]
        assert repo_data["owner"] == "getsentry"
        assert repo_data["name"] == "sentry"

    def test_post_deduplicates_by_resolved_repository_id(self) -> None:
        request_data = {
            "repositories": [
                {
                    "repository_id": self.repository.id,
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                    "branch_name": "first-branch",
                },
                {
                    "repository_id": self.repository.id,
                    "organization_id": self.org.id,
                    "integration_id": "222",
                    "provider": "gitlab",
                    "owner": "different-owner",
                    "name": "different-name",
                    "external_id": "different-external-id",
                    "branch_name": "second-branch",
                },
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        seer_repos = list(
            SeerProjectRepository.objects.filter(project_repository__project=self.project)
        )
        assert len(seer_repos) == 1
        assert seer_repos[0].project_repository.repository_id == self.repository.id
        assert seer_repos[0].branch_name == "first-branch"

    def test_post_resolves_before_deduplicating(self) -> None:
        other_repo = self.create_repo(
            project=self.project,
            name="other/repo",
            provider="integrations:github",
            external_id="other-external-id",
        )
        stale_identity = {
            "organization_id": self.org.id,
            "integration_id": "111",
            "provider": "github",
            "owner": "stale-owner",
            "name": "stale-name",
            "external_id": "stale-external-id",
        }
        request_data = {
            "repositories": [
                {"repository_id": self.repository.id, **stale_identity},
                {"repository_id": other_repo.id, **stale_identity},
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        repository_ids = set(
            SeerProjectRepository.objects.filter(
                project_repository__project=self.project
            ).values_list("project_repository__repository_id", flat=True)
        )
        assert repository_ids == {self.repository.id, other_repo.id}

    def test_post_rejects_unsupported_repo_provider(self) -> None:
        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "111",
                    "provider": "gitlab",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 400
        assert (
            SeerProjectRepository.objects.filter(project_repository__project=self.project).count()
            == 0
        )

    def test_post_accepts_gitlab_repo(self) -> None:
        gitlab_repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry-gitlab",
            provider="integrations:gitlab",
            external_id="789",
            integration_id=456,
        )
        gitlab_repo.update(config={"path": "getsentry/sentry-gitlab"})

        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "456",
                    "provider": "integrations:gitlab",
                    "owner": "getsentry",
                    "name": "sentry-gitlab",
                    "external_id": "789",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        seer_repos = list(
            SeerProjectRepository.objects.filter(
                project_repository__project=self.project
            ).select_related("project_repository__repository")
        )
        assert len(seer_repos) == 1
        assert seer_repos[0].project_repository.repository_id == gitlab_repo.id

    def test_post_accepts_gitlab_bare_provider(self) -> None:
        gitlab_repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry-gitlab",
            provider="integrations:gitlab",
            external_id="789",
            integration_id=456,
        )
        gitlab_repo.update(config={"path": "getsentry/sentry-gitlab"})

        request_data = {
            "repositories": [
                {
                    "organization_id": self.org.id,
                    "integration_id": "456",
                    "provider": "gitlab",
                    "owner": "getsentry",
                    "name": "sentry-gitlab",
                    "external_id": "789",
                }
            ],
        }

        response = self.client.post(self.url, data=request_data)

        assert response.status_code == 204
        seer_repos = list(
            SeerProjectRepository.objects.filter(
                project_repository__project=self.project
            ).select_related("project_repository__repository")
        )
        assert len(seer_repos) == 1
        assert seer_repos[0].project_repository.repository_id == gitlab_repo.id

    def test_gitlab_preference_round_trip_uses_repository_id(self) -> None:
        gitlab_repo = self.create_repo(
            project=self.project,
            name="Display Group / Display Project",
            provider="integrations:gitlab",
            external_id="gitlab.example:789",
            integration_id=456,
        )
        gitlab_repo.update(config={"path": "url-safe-group/url-safe-project"})
        self.create_seer_project_repository(project=self.project, repository=gitlab_repo)

        get_response = self.client.get(self.url)
        request_data = get_response.data["preference"]
        repo_data = request_data["repositories"][0]
        assert repo_data["repository_id"] == gitlab_repo.id
        assert repo_data["owner"] == "url-safe-group"
        assert repo_data["name"] == "url-safe-project"

        post_response = self.client.post(self.url, data=request_data)

        assert post_response.status_code == 204
        seer_repo = SeerProjectRepository.objects.get(project_repository__project=self.project)
        assert seer_repo.project_repository.repository_id == gitlab_repo.id

    @patch("sentry.seer.endpoints.project_seer_preferences.sentry_sdk.capture_exception")
    def test_post_rejects_gitlab_repo_without_url_path(
        self, mock_capture_exception: MagicMock
    ) -> None:
        gitlab_repo = self.create_repo(
            project=self.project,
            name="Display Group / Display Project",
            provider="integrations:gitlab",
            external_id="gitlab.example:missing-path",
            integration_id=456,
        )

        response = self.client.post(
            self.url,
            data={"repositories": [{"repository_id": gitlab_repo.id}]},
        )

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid repository"
        mock_capture_exception.assert_called_once()
