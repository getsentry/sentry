from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.seer.models.project_repository import (
    SeerProjectRepository,
    SeerProjectRepositoryBranchOverride,
)
from sentry.testutils.cases import APITestCase


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
        unsupported_repo = self.create_repo(
            project=self.project,
            name="getsentry/other",
            provider="integrations:bitbucket",
            external_id="222",
        )
        self.create_seer_project_repository(self.project, repository=unsupported_repo)

        response = self.client.get(self.detail_url(unsupported_repo.id))
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

    def test_not_connected_returns_404(self):
        self.get_error_response(branchName="main", status_code=404)

    def test_set_null_branch_name(self):
        self.create_seer_project_repository(self.project, repository=self.repo1, branch_name="main")

        response = self.get_success_response(branchName=None)
        assert response.data["branchName"] is None

    def test_clear_branch_overrides(self):
        pr = self.create_seer_project_repository(self.project, repository=self.repo1)
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

    def test_inactive_repo_returns_404(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)
        self.repo1.status = ObjectStatus.PENDING_DELETION
        self.repo1.save()

        self.get_error_response(branchName="develop", status_code=404)

    def test_unsupported_provider_returns_404(self):
        unsupported_repo = self.create_repo(
            project=self.project,
            name="getsentry/other",
            provider="integrations:bitbucket",
            external_id="222",
        )
        self.create_seer_project_repository(self.project, repository=unsupported_repo)

        url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id": self.project.id,
                "repo_id": unsupported_repo.id,
            },
        )
        response = self.client.put(url, data={"branchName": "develop"}, format="json")
        assert response.status_code == 404

    def test_empty_body_returns_400(self):
        self.create_seer_project_repository(self.project, repository=self.repo1)

        self.get_error_response(status_code=400)


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
        unsupported_repo = self.create_repo(
            project=self.project,
            name="getsentry/other",
            provider="integrations:bitbucket",
            external_id="222",
        )
        self.create_seer_project_repository(self.project, repository=unsupported_repo)

        url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id": self.project.id,
                "repo_id": unsupported_repo.id,
            },
        )
        response = self.client.delete(url)
        assert response.status_code == 404
