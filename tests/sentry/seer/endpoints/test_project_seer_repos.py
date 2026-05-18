from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository
from sentry.seer.models.project_repository import (
    SeerProjectRepository,
    SeerProjectRepositoryBranchOverride,
)
from sentry.testutils.cases import APITestCase


class OrganizationSeerProjectReposGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-project-repos"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id": self.project.id,
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
        SeerProjectRepository.objects.create(
            project=self.project,
            repository=self.repo1,
            branch_name="main",
            instructions="use pytest",
        )
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo2)

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

    def test_excludes_inactive_repos(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        self.repo1.status = ObjectStatus.HIDDEN
        self.repo1.save()

        response = self.get_success_response()
        assert len(response.data) == 0

    def test_returns_branch_overrides(self):
        project_repo = SeerProjectRepository.objects.create(
            project=self.project, repository=self.repo1
        )
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
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"query": "relay"})
        assert len(response.data) == 1
        assert response.data[0]["name"] == "relay"

    def test_search_by_name_exclude(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"query": "!name:relay"})
        assert len(response.data) == 1
        assert response.data[0]["name"] == "sentry"

    def test_search_by_provider(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"query": "provider:github"})
        assert len(response.data) == 2

        response = self.get_success_response(qs_params={"query": "provider:integrations:github"})
        assert len(response.data) == 2

    def test_sort_by_name_ascending(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"sortBy": "name"})
        names = [r["name"] for r in response.data]
        assert names == ["relay", "sentry"]

    def test_sort_by_name_descending(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo2)

        response = self.get_success_response(qs_params={"sortBy": "-name"})
        names = [r["name"] for r in response.data]
        assert names == ["sentry", "relay"]

    def test_invalid_sort_field(self):
        response = self.get_error_response(qs_params={"sortBy": "invalid"}, status_code=400)
        assert "Invalid sortBy" in response.data["detail"]

    def test_invalid_search_query(self):
        self.get_error_response(qs_params={"query": "invalid:field:value"}, status_code=400)


class OrganizationSeerProjectReposPostTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-project-repos"
    method = "post"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id": self.project.id,
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
        response = self.get_success_response(
            repos=[
                {
                    "repositoryId": self.repo1.id,
                    "branchName": "main",
                    "instructions": "run tests",
                },
                {"repositoryId": self.repo2.id},
            ],
            status_code=201,
        )
        assert len(response.data) == 2

        project_repos_by_id = {r["repositoryId"]: r for r in response.data}
        assert project_repos_by_id[str(self.repo1.id)]["branchName"] == "main"
        assert project_repos_by_id[str(self.repo1.id)]["instructions"] == "run tests"
        assert project_repos_by_id[str(self.repo2.id)]["branchName"] is None

        assert SeerProjectRepository.objects.filter(project=self.project).count() == 2

    def test_add_repos_with_branch_overrides(self):
        response = self.get_success_response(
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
            status_code=201,
        )
        assert len(response.data[0]["branchOverrides"]) == 1
        assert response.data[0]["branchOverrides"][0]["branchName"] == "release"

    def test_empty_repos_returns_400(self):
        response = self.get_error_response(repos=[], status_code=400)
        assert "repos must not be empty" in response.data["detail"]

    def test_invalid_repo_id_returns_400(self):
        response = self.get_error_response(repos=[{"repositoryId": 99999}], status_code=400)
        assert "Invalid repository IDs" in response.data["detail"]

    def test_repo_from_other_org_returns_400(self):
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

    def test_already_connected_repo_returns_409(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)

        response = self.get_error_response(repos=[{"repositoryId": self.repo1.id}], status_code=409)
        assert "Repositories already connected" in response.data["detail"]

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


class OrganizationSeerProjectReposPutTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-project-repos"
    method = "put"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id": self.project.id,
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
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)

        response = self.get_success_response(
            repos=[{"repositoryId": self.repo2.id, "branchName": "develop"}],
        )
        assert len(response.data) == 1
        assert response.data[0]["repositoryId"] == str(self.repo2.id)
        assert response.data[0]["branchName"] == "develop"

        assert not SeerProjectRepository.objects.filter(
            project=self.project, repository=self.repo1
        ).exists()

    def test_replace_with_empty_clears_all(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo2)

        response = self.get_success_response(repos=[])
        assert response.data == []
        assert SeerProjectRepository.objects.filter(project=self.project).count() == 0

    def test_replace_invalid_repo_returns_400(self):
        self.get_error_response(repos=[{"repositoryId": 99999}], status_code=400)

    def test_replace_with_branch_overrides(self):
        response = self.get_success_response(
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
        )
        assert len(response.data[0]["branchOverrides"]) == 1


class OrganizationSeerProjectRepoDetailsGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-project-repo-details"

    def detail_url(self, repo_id):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id": self.project.id,
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
        project_repo = SeerProjectRepository.objects.create(
            project=self.project, repository=self.repo1, branch_name="main", instructions="hello"
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

    def test_not_connected_returns_404(self):
        self.get_error_response(status_code=404)

    def test_inactive_repo_returns_404(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        self.repo1.status = ObjectStatus.HIDDEN
        self.repo1.save()

        self.get_error_response(status_code=404)

    def test_nonexistent_repo_returns_404(self):
        response = self.client.get(self.detail_url(99999))
        assert response.status_code == 404


class OrganizationSeerProjectRepoDetailsPutTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-project-repo-details"
    method = "put"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id": self.project.id,
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
        SeerProjectRepository.objects.create(
            project=self.project, repository=self.repo1, branch_name="main"
        )

        response = self.get_success_response(branchName="develop")
        assert response.data["branchName"] == "develop"

    def test_update_instructions(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)

        response = self.get_success_response(instructions="new instructions")
        assert response.data["instructions"] == "new instructions"

    def test_update_branch_overrides(self):
        pr = SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
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
        SeerProjectRepository.objects.create(
            project=self.project, repository=self.repo1, branch_name="main", instructions="original"
        )

        response = self.get_success_response(branchName="develop")
        assert response.data["branchName"] == "develop"
        assert response.data["instructions"] == "original"

    def test_not_connected_returns_404(self):
        self.get_error_response(branchName="main", status_code=404)

    def test_set_null_branch_name(self):
        SeerProjectRepository.objects.create(
            project=self.project, repository=self.repo1, branch_name="main"
        )

        response = self.get_success_response(branchName=None)
        assert response.data["branchName"] is None

    def test_clear_branch_overrides(self):
        pr = SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=pr,
            tag_name="environment",
            tag_value="production",
            branch_name="release",
        )

        response = self.get_success_response(branchOverrides=[])
        assert response.data["branchOverrides"] == []
        assert (
            SeerProjectRepositoryBranchOverride.objects.filter(seer_project_repository=pr).count()
            == 0
        )


class OrganizationSeerProjectRepoDetailsDeleteTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-project-repo-details"
    method = "delete"

    def reverse_url(self):
        return reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id": self.project.id,
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
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)

        self.get_success_response()
        assert not SeerProjectRepository.objects.filter(
            project=self.project, repository=self.repo1
        ).exists()

    def test_delete_not_connected_returns_404(self):
        self.get_error_response(status_code=404)

    def test_delete_inactive_repo_returns_404(self):
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        self.repo1.status = ObjectStatus.HIDDEN
        self.repo1.save()

        self.get_error_response(status_code=404)

    def test_delete_cascades_branch_overrides(self):
        pr = SeerProjectRepository.objects.create(project=self.project, repository=self.repo1)
        SeerProjectRepositoryBranchOverride.objects.create(
            seer_project_repository=pr,
            tag_name="environment",
            tag_value="production",
            branch_name="release",
        )

        self.get_success_response()
        assert SeerProjectRepositoryBranchOverride.objects.count() == 0
