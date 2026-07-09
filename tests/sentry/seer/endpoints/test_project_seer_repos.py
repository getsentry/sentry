from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository
from sentry.seer.models.project_repository import (
    SeerProjectRepository,
    SeerProjectRepositoryBranchOverride,
)
from sentry.testutils.cases import APITestCase


class ProjectSeerRepoGetTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-repo"

    def detail_url(self, repo_id):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "repo_id": repo_id,
            },
        )

    def reverse_url(self):
        return self.detail_url(self.repo1.id)

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.repo1 = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="111",
        )

    def test_get_repo(self):
        project_repo = self.create_seer_project_repository(
            self.project, repository=self.repo1, branch_name="main", instructions="hello"
        )
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=project_repo,
            tag_name="environment",
            tag_value="production",
            branch_name="release",
        )

        response = self.get_success_response()
        assert response.data["repositoryId"] == str(self.repo1.id)
        assert response.data["branchName"] == "main"
        assert response.data["instructions"] == "hello"
        assert len(response.data["branchOverrides"]) == 1
        assert response.data["branchOverrides"][0]["tagName"] == "environment"
        assert response.data["branchOverrides"][0]["tagValue"] == "production"
        assert response.data["branchOverrides"][0]["branchName"] == "release"

    def test_not_connected_repo_returns_404(self):
        self.get_error_response(status_code=404)

    def test_inactive_repo_returns_404(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.repo1.status = ObjectStatus.HIDDEN
        self.repo1.save()

        self.get_error_response(status_code=404)

    def test_nonexistent_repo_returns_404(self):
        response = self.client.get(self.detail_url(99999))
        assert response.status_code == 404

    def test_unsupported_provider_returns_404(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.repo1.provider = "integrations:bitbucket"
        self.repo1.save()

        self.get_error_response(status_code=404)

    def test_other_project_repo_returns_404(self):
        other_project = self.create_project(organization=self.organization)
        self.create_seer_project_repository(other_project, repository=self.repo1)

        self.get_error_response(status_code=404)


class ProjectSeerRepoPutTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-repo"
    method = "put"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "repo_id": self.repo1.id,
            },
        )

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.repo1 = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="111",
        )

    def test_update_branch_name(self):
        self.create_seer_project_repository(self.project, repository=self.repo1, branch_name="main")

        response = self.get_success_response(branchName="develop")
        assert response.data["branchName"] == "develop"

    def test_update_instructions(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)

        response = self.get_success_response(instructions="new instructions")
        assert response.data["instructions"] == "new instructions"

    def test_update_branch_overrides(self):
        pr = self.create_seer_project_repository(self.project, repository=self.repo1)
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=pr,
            tag_name="environment",
            tag_value="production",
            branch_name="old-branch",
        )

        response = self.get_success_response(
            branchOverrides=[
                {
                    "tagName": "environment",
                    "tagValue": "staging",
                    "branchName": "staging-branch",
                }
            ],
        )
        assert len(response.data["branchOverrides"]) == 1
        assert response.data["branchOverrides"][0]["tagValue"] == "staging"

        assert (
            SeerProjectRepositoryBranchOverride.objects.filter(seer_project_repository=pr).count()
            == 1
        )

    def test_partial_update_preserves_other_fields(self):
        self.create_seer_project_repository(
            self.project, repository=self.repo1, branch_name="main", instructions="original"
        )

        response = self.get_success_response(branchName="develop")
        assert response.data["branchName"] == "develop"
        assert response.data["instructions"] == "original"

    def test_partial_update_preserves_branch_overrides(self):
        project_repo = self.create_seer_project_repository(
            self.project, repository=self.repo1, branch_name="main"
        )
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=project_repo,
            tag_name="env",
            tag_value="prod",
            branch_name="release",
        )

        response = self.get_success_response(branchName="develop")
        assert response.data["branchName"] == "develop"
        assert len(response.data["branchOverrides"]) == 1
        assert response.data["branchOverrides"][0]["tagName"] == "env"
        assert response.data["branchOverrides"][0]["branchName"] == "release"

    def test_clear_branch_overrides(self):
        project_repo = self.create_seer_project_repository(self.project, repository=self.repo1)
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=project_repo,
            tag_name="environment",
            tag_value="production",
            branch_name="release",
        )

        response = self.get_success_response(branchOverrides=[])
        assert response.data["branchOverrides"] == []
        assert (
            SeerProjectRepositoryBranchOverride.objects.filter(
                seer_project_repository=project_repo
            ).count()
            == 0
        )

    def test_set_null_branch_name(self):
        self.create_seer_project_repository(self.project, repository=self.repo1, branch_name="main")

        response = self.get_success_response(branchName=None)
        assert response.data["branchName"] is None

    def test_not_connected_returns_404(self):
        self.get_error_response(branchName="main", status_code=404)

    def test_inactive_repo_returns_404(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.repo1.status = ObjectStatus.PENDING_DELETION
        self.repo1.save()

        self.get_error_response(branchName="develop", status_code=404)

    def test_unsupported_provider_returns_404(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.repo1.provider = "integrations:bitbucket"
        self.repo1.save()

        self.get_error_response(branchName="develop", status_code=404)

    def test_empty_body_returns_400(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)

        self.get_error_response(status_code=400)

    def test_other_project_repo_returns_404(self):
        other_project = self.create_project(organization=self.organization)
        self.create_seer_project_repository(other_project, repository=self.repo1)

        self.get_error_response(branchName="develop", status_code=404)

    def test_duplicate_branch_overrides_returns_400(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)

        self.get_error_response(
            branchOverrides=[
                {"tagName": "environment", "tagValue": "production", "branchName": "release"},
                {"tagName": "environment", "tagValue": "production", "branchName": "hotfix"},
            ],
            status_code=400,
        )

    def test_branch_overrides_does_not_bump_date_updated(self):
        project_repo = self.create_seer_project_repository(
            self.project, repository=self.repo1, branch_name="main"
        )
        original_date_updated = project_repo.date_updated

        self.get_success_response(
            branchOverrides=[
                {"tagName": "environment", "tagValue": "staging", "branchName": "staging-branch"},
            ],
        )

        project_repo.refresh_from_db()
        assert project_repo.date_updated == original_date_updated


class ProjectSeerRepoDeleteTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-repo"
    method = "delete"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "repo_id": self.repo1.id,
            },
        )

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.repo1 = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="111",
        )

    def test_delete_repo(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)

        self.get_success_response()
        assert not SeerProjectRepository.objects.filter(
            project_repository__project=self.project,
            project_repository__repository=self.repo1,
        ).exists()

    def test_cascades_branch_overrides(self):
        project_repo = self.create_seer_project_repository(self.project, repository=self.repo1)
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=project_repo,
            tag_name="environment",
            tag_value="production",
            branch_name="release",
        )

        self.get_success_response()
        assert SeerProjectRepositoryBranchOverride.objects.count() == 0

    def test_not_connected_repo_returns_404(self):
        self.get_error_response(status_code=404)

    def test_inactive_repo_returns_404(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.repo1.status = ObjectStatus.HIDDEN
        self.repo1.save()

        self.get_error_response(status_code=404)

    def test_unsupported_provider_returns_404(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.repo1.provider = "integrations:bitbucket"
        self.repo1.save()

        self.get_error_response(status_code=404)

    def test_other_project_repo_returns_404(self):
        other_project = self.create_project(organization=self.organization)
        self.create_seer_project_repository(other_project, repository=self.repo1)

        self.get_error_response(status_code=404)


class ProjectSeerReposGetTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-repos"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="ext123"
        )
        self.repo1 = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="111",
            integration_id=self.integration.id,
        )
        self.repo2 = self.create_repo(
            project=self.project,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="222",
            integration_id=self.integration.id,
        )

    def test_empty(self):
        response = self.get_success_response()
        assert len(response.data) == 0

    def test_returns_connected_repos(self):
        self.create_seer_project_repository(
            self.project,
            repository=self.repo1,
            branch_name="main",
            instructions="use pytest",
        )
        self.create_seer_project_repository(self.project, repository=self.repo2)

        response = self.get_success_response()
        assert len(response.data) == 2

        project_repos_by_name = {r["name"]: r for r in response.data}
        project_repo_sentry = project_repos_by_name["sentry"]
        assert project_repo_sentry["repositoryId"] == str(self.repo1.id)
        assert project_repo_sentry["provider"] == "integrations:github"
        assert project_repo_sentry["owner"] == "getsentry"
        assert project_repo_sentry["externalId"] == "111"
        assert project_repo_sentry["integrationId"] == str(self.integration.id)
        assert project_repo_sentry["branchName"] == "main"
        assert project_repo_sentry["instructions"] == "use pytest"

        project_repo_relay = project_repos_by_name["relay"]
        assert project_repo_relay["repositoryId"] == str(self.repo2.id)
        assert project_repo_relay["branchName"] is None
        assert project_repo_relay["instructions"] is None

    def test_gitlab_repo_uses_display_name(self):
        """The settings serializer's owner/name are display-only and must mirror
        repo.name (GitLab's name_with_namespace), the same value the repo picker
        shows. The URL-safe config['path'] is used only when building SCM links
        sent to Seer (see seer/autofix/utils.py::get_repo_url_path), not here."""
        gitlab_integration = self.create_integration(
            organization=self.organization, provider="gitlab", external_id="gl123"
        )
        gitlab_repo = self.create_repo(
            project=self.project,
            # name_with_namespace: human-readable display name that contains spaces
            name="My Group / My Project",
            provider="integrations:gitlab",
            external_id="gl-999",
            integration_id=gitlab_integration.id,
        )
        self.create_seer_project_repository(self.project, repository=gitlab_repo)

        with self.feature("organizations:seer-gitlab-support"):
            response = self.get_success_response()
        assert len(response.data) == 1
        repo_data = response.data[0]
        # owner/name come from the display name (repo.name) and reconstruct it,
        # matching the picker — they are NOT slugified to the config['path'].
        assert repo_data["owner"] == "My Group "
        assert repo_data["name"] == " My Project"
        assert f"{repo_data['owner']}/{repo_data['name']}" == gitlab_repo.name

    def test_excludes_inactive_repos(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.repo1.status = ObjectStatus.HIDDEN
        self.repo1.save()

        response = self.get_success_response()
        assert len(response.data) == 0

    def test_returns_branch_overrides(self):
        project_repo = self.create_seer_project_repository(self.project, repository=self.repo1)
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=project_repo,
            tag_name="environment",
            tag_value="production",
            branch_name="release",
        )

        response = self.get_success_response()
        assert len(response.data[0]["branchOverrides"]) == 1
        branch_overrides = response.data[0]["branchOverrides"][0]
        assert branch_overrides["tagName"] == "environment"
        assert branch_overrides["tagValue"] == "production"
        assert branch_overrides["branchName"] == "release"

    def test_search_by_name(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.create_seer_project_repository(self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"query": "relay"})
        assert len(response.data) == 1
        assert response.data[0]["name"] == "relay"

    def test_search_by_name_exclude(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.create_seer_project_repository(self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"query": "!name:relay"})
        assert len(response.data) == 1
        assert response.data[0]["name"] == "sentry"

    def test_search_by_provider(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.create_seer_project_repository(self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"query": "provider:github"})
        assert len(response.data) == 2

        response = self.get_success_response(qs_params={"query": "provider:integrations:github"})
        assert len(response.data) == 2

    def test_sort_by_name_ascending(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.create_seer_project_repository(self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"sortBy": "name"})
        names = [r["name"] for r in response.data]
        assert names == ["relay", "sentry"]

    def test_sort_by_name_descending(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.create_seer_project_repository(self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"sortBy": "-name"})
        names = [r["name"] for r in response.data]
        assert names == ["sentry", "relay"]

    def test_sort_by_provider(self):
        gitlab_repo = self.create_repo(
            project=self.project,
            name="getsentry/other",
            provider="integrations:github_enterprise",
            external_id="333",
            integration_id=self.integration.id,
        )
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.create_seer_project_repository(self.project, repository=gitlab_repo)

        response = self.get_success_response(qs_params={"sortBy": "provider"})
        providers = [r["provider"] for r in response.data]
        assert providers == sorted(providers)

        response = self.get_success_response(qs_params={"sortBy": "-provider"})
        providers = [r["provider"] for r in response.data]
        assert providers == sorted(providers, reverse=True)

    def test_invalid_sort_field(self):
        response = self.get_error_response(qs_params={"sortBy": "invalid"}, status_code=400)
        assert "Invalid sortBy" in response.data["detail"]

    def test_invalid_search_query(self):
        self.get_error_response(qs_params={"query": "invalid:field:value"}, status_code=400)

    def test_excludes_unsupported_providers(self):
        unsupported_repo = self.create_repo(
            project=self.project,
            name="getsentry/other",
            provider="integrations:bitbucket",
            external_id="333",
        )
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.create_seer_project_repository(self.project, repository=unsupported_repo)

        response = self.get_success_response()
        assert len(response.data) == 1
        assert response.data[0]["name"] == "sentry"

    def test_other_project_repo_not_returned(self):
        other_project = self.create_project(organization=self.organization)
        self.create_seer_project_repository(other_project, repository=self.repo1)

        response = self.get_success_response()
        assert len(response.data) == 0


class ProjectSeerReposPostTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-repos"
    method = "post"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.repo1 = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="111",
        )
        self.repo2 = self.create_repo(
            project=self.project,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="222",
        )

    def test_add_repos(self):
        self.get_success_response(
            repos=[
                {
                    "repositoryId": self.repo1.id,
                    "branchName": "main",
                    "instructions": "run tests",
                },
                {"repositoryId": self.repo2.id},
            ],
            status_code=204,
        )

        project_repos = SeerProjectRepository.objects.filter(
            project_repository__project=self.project
        ).select_related("project_repository")
        assert project_repos.count() == 2
        by_repo_id = {pr.project_repository.repository_id: pr for pr in project_repos}
        assert by_repo_id[self.repo1.id].branch_name == "main"
        assert by_repo_id[self.repo1.id].instructions == "run tests"
        assert by_repo_id[self.repo2.id].branch_name is None

    def test_add_repos_with_branch_overrides(self):
        self.get_success_response(
            repos=[
                {
                    "repositoryId": self.repo1.id,
                    "branchOverrides": [
                        {
                            "tagName": "environment",
                            "tagValue": "production",
                            "branchName": "release",
                        }
                    ],
                }
            ],
            status_code=204,
        )

        project_repo = SeerProjectRepository.objects.get(
            project_repository__project=self.project,
            project_repository__repository=self.repo1,
        )
        overrides = list(project_repo.branch_overrides.all())
        assert len(overrides) == 1
        assert overrides[0].branch_name == "release"

    def test_empty_repos_returns_400(self):
        response = self.get_error_response(repos=[], status_code=400)
        assert "repos must not be empty" in response.data["detail"]

    def test_invalid_repo_id_returns_400(self):
        response = self.get_error_response(repos=[{"repositoryId": 99999}], status_code=400)
        assert "Invalid repository IDs" in response.data["detail"]

    def test_other_org_repo_returns_400(self):
        other_org = self.create_organization(owner=self.user)
        other_repo = Repository.objects.create(
            organization_id=other_org.id, name="other/repo", provider="github", external_id="999"
        )

        self.get_error_response(repos=[{"repositoryId": other_repo.id}], status_code=400)

    def test_unsupported_provider_returns_400(self):
        unsupported_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/unsupported",
            provider="integrations:gitlab",
            external_id="999",
        )

        self.get_error_response(repos=[{"repositoryId": unsupported_repo.id}], status_code=400)

    def test_upsert_existing_repo(self):
        self.create_seer_project_repository(
            self.project, repository=self.repo1, branch_name="old-branch"
        )

        self.get_success_response(
            repos=[{"repositoryId": self.repo1.id, "branchName": "new-branch"}],
            status_code=204,
        )

        project_repo = SeerProjectRepository.objects.get(
            project_repository__project=self.project,
            project_repository__repository=self.repo1,
        )
        assert project_repo.branch_name == "new-branch"

    def test_inactive_repo_returns_400(self):
        self.repo1.status = ObjectStatus.HIDDEN
        self.repo1.save()

        self.get_error_response(repos=[{"repositoryId": self.repo1.id}], status_code=400)

    def test_duplicate_branch_override_returns_400(self):
        self.get_error_response(
            repos=[
                {
                    "repositoryId": self.repo1.id,
                    "branchOverrides": [
                        {
                            "tagName": "environment",
                            "tagValue": "production",
                            "branchName": "release",
                        },
                        {
                            "tagName": "environment",
                            "tagValue": "production",
                            "branchName": "hotfix",
                        },
                    ],
                }
            ],
            status_code=400,
        )

    def test_missing_repository_id_returns_400(self):
        self.get_error_response(repos=[{"branchName": "main"}], status_code=400)

    def test_duplicate_repository_ids_returns_400(self):
        self.get_error_response(
            repos=[
                {"repositoryId": self.repo1.id},
                {"repositoryId": self.repo1.id},
            ],
            status_code=400,
        )


class ProjectSeerReposPutTest(APITestCase):
    endpoint = "sentry-api-0-project-seer-repos"
    method = "put"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.repo1 = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="111",
        )
        self.repo2 = self.create_repo(
            project=self.project,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="222",
        )

    def test_replace_all_repos(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)

        self.get_success_response(
            repos=[{"repositoryId": self.repo2.id, "branchName": "develop"}],
            status_code=204,
        )

        assert not SeerProjectRepository.objects.filter(
            project_repository__project=self.project,
            project_repository__repository=self.repo1,
        ).exists()
        new_repo = SeerProjectRepository.objects.get(
            project_repository__project=self.project,
            project_repository__repository=self.repo2,
        )
        assert new_repo.branch_name == "develop"

    def test_replace_with_empty_clears_all(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.create_seer_project_repository(self.project, repository=self.repo2)

        self.get_success_response(repos=[], status_code=204)
        assert (
            SeerProjectRepository.objects.filter(project_repository__project=self.project).count()
            == 0
        )

    def test_replace_invalid_repo_returns_400(self):
        self.get_error_response(repos=[{"repositoryId": 99999}], status_code=400)

    def test_replace_with_branch_overrides(self):
        self.get_success_response(
            repos=[
                {
                    "repositoryId": self.repo1.id,
                    "branchOverrides": [
                        {
                            "tagName": "environment",
                            "tagValue": "staging",
                            "branchName": "staging-branch",
                        }
                    ],
                }
            ],
            status_code=204,
        )

        project_repo = SeerProjectRepository.objects.get(
            project_repository__project=self.project,
            project_repository__repository=self.repo1,
        )
        assert project_repo.branch_overrides.count() == 1

    def test_replace_unsupported_provider_returns_400(self):
        unsupported_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/unsupported",
            provider="integrations:gitlab",
            external_id="999",
        )

        self.get_error_response(repos=[{"repositoryId": unsupported_repo.id}], status_code=400)

    def test_other_org_repo_returns_400(self):
        other_org = self.create_organization(owner=self.user)
        other_repo = Repository.objects.create(
            organization_id=other_org.id, name="other/repo", provider="github", external_id="999"
        )

        self.get_error_response(repos=[{"repositoryId": other_repo.id}], status_code=400)
