from sentry.constants import ObjectStatus
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase


class ProjectRepoPostTest(APITestCase):
    endpoint = "sentry-api-0-project-repo"
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


class ProjectRepoGetTest(APITestCase):
    endpoint = "sentry-api-0-project-repo"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )

    def test_empty(self) -> None:
        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert response.data == []

    def test_returns_linked_repo_without_count(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.MANUAL,
        )

        response = self.get_success_response(self.organization.slug, self.project.slug)

        assert len(response.data) == 1
        row = response.data[0]
        assert row["repoName"] == "getsentry/sentry"
        assert row["providerKey"] == "github"
        assert row["source"] == "manual"
        assert "mappingCount" not in row

    def test_include_maps_count_zero(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.MANUAL,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={"includeMapsCount": "1"},
        )

        assert len(response.data) == 1
        assert response.data[0]["mappingCount"] == 0

    def test_include_maps_count_with_mappings(self) -> None:
        integration, org_integration = self.create_provider_integration_for(
            self.organization, self.user, provider="github", name="GitHub", external_id="gh-1"
        )
        repo_b = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="456",
            integration_id=integration.id,
        )

        # repo A: 2 mappings, repo B: 1 mapping; a third repo on another project must not appear
        other_project = self.create_project(organization=self.organization)
        other_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/other",
            provider="integrations:github",
            external_id="789",
        )
        ProjectRepository.objects.create(
            project=other_project, repository=other_repo, source=ProjectRepositorySource.MANUAL
        )

        self.create_code_mapping(
            project=self.project,
            repo=self.repo,
            organization_integration=org_integration,
            stack_root="src/",
        )
        self.create_code_mapping(
            project=self.project,
            repo=self.repo,
            organization_integration=org_integration,
            stack_root="tests/",
        )
        self.create_code_mapping(
            project=self.project,
            repo=repo_b,
            organization_integration=org_integration,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={"includeMapsCount": "1"},
        )

        assert len(response.data) == 2
        by_name = {row["repoName"]: row for row in response.data}
        assert by_name["getsentry/sentry"]["mappingCount"] == 2
        assert by_name["getsentry/relay"]["mappingCount"] == 1

    def test_excludes_inactive_repos(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.MANUAL,
        )
        self.repo.status = ObjectStatus.HIDDEN
        self.repo.save()

        response = self.get_success_response(self.organization.slug, self.project.slug)
        assert response.data == []
