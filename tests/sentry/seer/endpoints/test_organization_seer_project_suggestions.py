from __future__ import annotations

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import parse_link_header

QUICK_ADD_FEATURE = "organizations:seer-autofix-quick-add"
GITLAB_FEATURE = "organizations:seer-gitlab-support"
GITHUB_PROVIDER = "integrations:github"


class OrganizationSeerProjectSuggestionsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-seer-project-suggestions",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.repository_index = 0

    def create_project_repository(
        self,
        *,
        project: Project | None = None,
        source: ProjectRepositorySource = ProjectRepositorySource.MANUAL,
        provider: str | None = GITHUB_PROVIDER,
        status: int = ObjectStatus.ACTIVE,
        repository_organization_id: int | None = None,
        name: str | None = None,
    ) -> tuple[Repository, ProjectRepository]:
        project = project or self.project
        self.repository_index += 1
        repository = Repository.objects.create(
            organization_id=repository_organization_id or project.organization_id,
            name=name or f"owner/repository-{self.repository_index}",
            provider=provider,
            status=status,
        )
        project_repository = ProjectRepository.objects.create(
            project=project,
            repository=repository,
            source=source,
        )
        return repository, project_repository

    def get_suggestions(self, query: dict[str, str] | None = None):
        with self.feature(QUICK_ADD_FEATURE):
            return self.client.get(self.url, query or {})

    def test_feature_disabled_returns_404(self) -> None:
        self.create_project_repository()

        response = self.client.get(self.url)

        assert response.status_code == 404

    def test_manual_and_scm_onboarding_links_are_eligible(self) -> None:
        manual_project = self.create_project(organization=self.organization, slug="manual-project")
        onboarding_project = self.create_project(
            organization=self.organization, slug="onboarding-project"
        )
        self.create_project_repository(
            project=manual_project, source=ProjectRepositorySource.MANUAL
        )
        self.create_project_repository(
            project=onboarding_project, source=ProjectRepositorySource.SCM_ONBOARDING
        )

        response = self.get_suggestions()

        assert response.status_code == 200
        assert {suggestion["projectSlug"] for suggestion in response.data} == {
            "manual-project",
            "onboarding-project",
        }

    def test_automatic_and_seer_preference_links_are_not_eligible(self) -> None:
        sources = (
            ProjectRepositorySource.AUTO_NAME_MATCH,
            ProjectRepositorySource.AUTO_EVENT,
            ProjectRepositorySource.SEER_PREFERENCE,
        )
        for index, source in enumerate(sources):
            project = self.create_project(
                organization=self.organization, slug=f"ineligible-project-{index}"
            )
            self.create_project_repository(project=project, source=source)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == []

    def test_repository_from_another_organization_is_not_eligible(self) -> None:
        other_organization = self.create_organization()
        self.create_project_repository(repository_organization_id=other_organization.id)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == []

    def test_inactive_repository_is_not_eligible(self) -> None:
        self.create_project_repository(status=ObjectStatus.DISABLED)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == []

    def test_github_and_github_enterprise_repositories_are_eligible(self) -> None:
        providers = ("integrations:github", "integrations:github_enterprise")
        projects = []
        for index, provider in enumerate(providers):
            project = self.create_project(
                organization=self.organization, slug=f"supported-provider-{index}"
            )
            self.create_project_repository(project=project, provider=provider)
            projects.append(project)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert {suggestion["projectId"] for suggestion in response.data} == {
            str(project.id) for project in projects
        }

    def test_gitlab_requires_support_feature(self) -> None:
        self.create_project_repository(provider="integrations:gitlab")

        response = self.get_suggestions()
        assert response.status_code == 200
        assert response.data == []

        with self.feature([QUICK_ADD_FEATURE, GITLAB_FEATURE]):
            response = self.client.get(self.url)

        assert response.status_code == 200
        assert [suggestion["projectId"] for suggestion in response.data] == [str(self.project.id)]

    def test_unsupported_provider_is_not_eligible(self) -> None:
        self.create_project_repository(provider="integrations:bitbucket")

        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == []

    def test_project_with_active_seer_repository_is_not_returned(self) -> None:
        _, project_repository = self.create_project_repository()
        SeerProjectRepository.objects.create(project_repository=project_repository)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == []

    def test_active_seer_preference_link_excludes_project_with_eligible_link(self) -> None:
        self.create_project_repository(source=ProjectRepositorySource.MANUAL)
        _, preference_link = self.create_project_repository(
            source=ProjectRepositorySource.SEER_PREFERENCE
        )
        SeerProjectRepository.objects.create(project_repository=preference_link)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == []

    def test_inactive_seer_link_does_not_exclude_project(self) -> None:
        self.create_project_repository(source=ProjectRepositorySource.MANUAL)
        _, inactive_preference_link = self.create_project_repository(
            source=ProjectRepositorySource.SEER_PREFERENCE,
            status=ObjectStatus.DISABLED,
        )
        SeerProjectRepository.objects.create(project_repository=inactive_preference_link)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert [suggestion["projectId"] for suggestion in response.data] == [str(self.project.id)]

    def test_project_without_eligible_repository_is_not_returned(self) -> None:
        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == []

    def test_response_contains_repository_metadata_in_stable_order(self) -> None:
        first_repository, _ = self.create_project_repository(name="owner/z-repository")
        second_repository, _ = self.create_project_repository(name="owner/a-repository")

        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == [
            {
                "projectId": str(self.project.id),
                "projectSlug": self.project.slug,
                "linkedReposCount": 2,
                "linkedRepositories": [
                    {
                        "repositoryId": str(first_repository.id),
                        "name": first_repository.name,
                        "provider": GITHUB_PROVIDER,
                    },
                    {
                        "repositoryId": str(second_repository.id),
                        "name": second_repository.name,
                        "provider": GITHUB_PROVIDER,
                    },
                ],
            }
        ]

    def test_repository_list_is_capped_but_count_is_not(self) -> None:
        repositories = [self.create_project_repository()[0] for _ in range(12)]

        response = self.get_suggestions()

        assert response.status_code == 200
        suggestion = response.data[0]
        assert suggestion["linkedReposCount"] == 12
        assert [repository["repositoryId"] for repository in suggestion["linkedRepositories"]] == [
            str(repository.id) for repository in repositories[:10]
        ]

    def test_pagination_caps_page_size_and_returns_link_headers(self) -> None:
        projects = []
        for index in range(12):
            project = self.create_project(
                organization=self.organization, slug=f"candidate-{index:02d}"
            )
            self.create_project_repository(project=project)
            projects.append(project)

        response = self.get_suggestions({"per_page": "100"})

        assert response.status_code == 200
        assert [suggestion["projectSlug"] for suggestion in response.data] == [
            project.slug for project in projects[:10]
        ]
        links = parse_link_header(response.headers["Link"])
        next_url, next_link = next(
            (url, link) for url, link in links.items() if link["rel"] == "next"
        )
        assert next_link["results"] == "true"

        with self.feature(QUICK_ADD_FEATURE):
            next_response = self.client.get(next_url)

        assert next_response.status_code == 200
        assert [suggestion["projectSlug"] for suggestion in next_response.data] == [
            project.slug for project in projects[10:]
        ]

    def test_only_returns_projects_the_user_can_access(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        accessible_team = self.create_team(organization=self.organization)
        inaccessible_team = self.create_team(organization=self.organization)
        accessible_project = self.create_project(
            organization=self.organization,
            teams=[accessible_team],
            slug="accessible-project",
        )
        inaccessible_project = self.create_project(
            organization=self.organization,
            teams=[inaccessible_team],
            slug="inaccessible-project",
        )
        self.create_project_repository(project=accessible_project)
        self.create_project_repository(project=inaccessible_project)
        restricted_user = self.create_user(is_superuser=False)
        self.create_member(
            organization=self.organization,
            user=restricted_user,
            role="member",
            teams=[accessible_team],
        )
        self.login_as(restricted_user)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert [suggestion["projectSlug"] for suggestion in response.data] == [
            accessible_project.slug
        ]

    def test_query_count_does_not_increase_per_project(self) -> None:
        self.create_project_repository()

        with self.feature(QUICK_ADD_FEATURE):
            self.client.get(self.url)
            with CaptureQueriesContext(connection) as single_project_queries:
                single_project_response = self.client.get(self.url)

            for index in range(4):
                project = self.create_project(
                    organization=self.organization, slug=f"query-count-project-{index}"
                )
                self.create_project_repository(project=project)

            with CaptureQueriesContext(connection) as multiple_project_queries:
                multiple_project_response = self.client.get(self.url)

        assert single_project_response.status_code == 200
        assert multiple_project_response.status_code == 200
        assert len(multiple_project_queries) == len(single_project_queries)

    def test_multiple_links_and_active_seer_link_do_not_multiply_counts(self) -> None:
        _, first_link = self.create_project_repository()
        self.create_project_repository()
        SeerProjectRepository.objects.create(project_repository=first_link)

        response = self.get_suggestions()

        assert response.status_code == 200
        assert response.data == []
