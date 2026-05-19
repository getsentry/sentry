from sentry.constants import ObjectStatus
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase


class ProjectRepoLinkTest(APITestCase):
    endpoint = "sentry-api-0-project-repo-link"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )

    def test_creates_link(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            repositoryId=self.repo.id,
            status_code=201,
        )
        assert response.data["repositoryId"] == str(self.repo.id)
        assert response.data["projectId"] == str(self.project.id)
        assert response.data["created"] is True

        pr = ProjectRepository.objects.get(project=self.project, repository=self.repo)
        assert pr.source == ProjectRepositorySource.SCM_ONBOARDING

    def test_idempotent(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.MANUAL,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            repositoryId=self.repo.id,
            status_code=200,
        )
        assert response.data["created"] is False
        assert response.data["source"] == "manual"
        assert (
            ProjectRepository.objects.filter(project=self.project, repository=self.repo).count()
            == 1
        )

    def test_repo_not_found(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            repositoryId=999999,
            status_code=404,
        )

    def test_repo_from_other_org(self) -> None:
        other_org = self.create_organization()
        other_repo = Repository.objects.create(
            organization_id=other_org.id,
            name="other/repo",
            provider="integrations:github",
            external_id="456",
        )

        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            repositoryId=other_repo.id,
            status_code=404,
        )

    def test_inactive_repo(self) -> None:
        self.repo.status = ObjectStatus.HIDDEN
        self.repo.save()

        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            repositoryId=self.repo.id,
            status_code=404,
        )

    def test_missing_repository_id(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            status_code=400,
        )
