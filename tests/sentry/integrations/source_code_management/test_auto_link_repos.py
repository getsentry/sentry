from sentry.constants import ObjectStatus
from sentry.integrations.source_code_management.auto_link_repos import (
    auto_link_repos_by_name,
    auto_link_repos_on_project_create,
    get_repo_name_candidates,
)
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class GetRepoNameCandidatesTest(TestCase):
    def test_github_format(self) -> None:
        assert get_repo_name_candidates("getsentry/sentry") == ["sentry", "getsentry-sentry"]

    def test_gitlab_format_spaces_around_slash(self) -> None:
        assert get_repo_name_candidates("getsentry / sentry") == ["sentry", "getsentry-sentry"]

    def test_bitbucket_server_display_names(self) -> None:
        assert get_repo_name_candidates("My Project/My Repo") == [
            "my-repo",
            "my-project-my-repo",
        ]

    def test_mixed_case(self) -> None:
        assert get_repo_name_candidates("GetSentry/Sentry-Backend") == [
            "sentry-backend",
            "getsentry-sentry-backend",
        ]

    def test_no_slash(self) -> None:
        assert get_repo_name_candidates("sentry-backend") == ["sentry-backend"]

    def test_nested_groups(self) -> None:
        assert get_repo_name_candidates("org/group/repo") == ["repo", "org-group-repo"]

    def test_empty_string(self) -> None:
        assert get_repo_name_candidates("") == []

    def test_dots_in_name(self) -> None:
        assert get_repo_name_candidates("my-org/my.repo.name") == [
            "myreponame",
            "my-org-myreponame",
        ]

    def test_underscores(self) -> None:
        assert get_repo_name_candidates("org/my_repo") == ["my_repo", "org-my_repo"]

    def test_trailing_slash(self) -> None:
        assert get_repo_name_candidates("org/repo/") == ["repo", "org-repo"]

    def test_only_slashes(self) -> None:
        assert get_repo_name_candidates("///") == []


class AutoLinkReposByNameTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org, slug="sentry")
        self.repo = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )

    def test_links_matching_repo_to_project(self) -> None:
        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            created = auto_link_repos_by_name(self.org, [self.repo.id])

        assert created == 1
        pr = ProjectRepository.objects.get(project=self.project, repository=self.repo)
        assert pr.source == ProjectRepositorySource.AUTO_NAME_MATCH

    def test_dry_run_does_not_create(self) -> None:
        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": True}),
        ):
            created = auto_link_repos_by_name(self.org, [self.repo.id])

        assert created == 0
        assert not ProjectRepository.objects.filter(
            project=self.project, repository=self.repo
        ).exists()

    def test_skips_when_flag_disabled(self) -> None:
        with self.options({"repository.auto-link-by-name-dry-run": False}):
            created = auto_link_repos_by_name(self.org, [self.repo.id])

        assert created == 0

    def test_skips_repo_already_linked(self) -> None:
        ProjectRepository.objects.create(
            project=self.create_project(organization=self.org, slug="other"),
            repository=self.repo,
            source=ProjectRepositorySource.MANUAL,
        )

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            created = auto_link_repos_by_name(self.org, [self.repo.id])

        assert created == 0

    def test_skips_project_already_has_link(self) -> None:
        other_repo = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/other",
            provider="integrations:github",
            external_id="456",
        )
        ProjectRepository.objects.create(
            project=self.project,
            repository=other_repo,
            source=ProjectRepositorySource.MANUAL,
        )

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            created = auto_link_repos_by_name(self.org, [self.repo.id])

        assert created == 0

    def test_no_match_when_names_differ(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="789",
        )

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            created = auto_link_repos_by_name(self.org, [repo.id])

        assert created == 0

    def test_skips_inactive_repos(self) -> None:
        self.repo.status = ObjectStatus.HIDDEN
        self.repo.save()

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            created = auto_link_repos_by_name(self.org, [self.repo.id])

        assert created == 0

    def test_multiple_repos_multiple_projects(self) -> None:
        project2 = self.create_project(organization=self.org, slug="relay")
        repo2 = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="456",
        )

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            created = auto_link_repos_by_name(self.org, [self.repo.id, repo2.id])

        assert created == 2
        assert ProjectRepository.objects.filter(project=self.project, repository=self.repo).exists()
        assert ProjectRepository.objects.filter(project=project2, repository=repo2).exists()

    def test_matches_second_candidate(self) -> None:
        project = self.create_project(organization=self.org, slug="getsentry-sentry")
        repo = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="999",
        )
        # self.project has slug="sentry" which would match the first candidate,
        # but it already has a link so it's excluded
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.MANUAL,
        )

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            created = auto_link_repos_by_name(self.org, [repo.id])

        assert created == 1
        pr = ProjectRepository.objects.get(project=project, repository=repo)
        assert pr.source == ProjectRepositorySource.AUTO_NAME_MATCH

    def test_empty_repo_ids(self) -> None:
        created = auto_link_repos_by_name(self.org, [])
        assert created == 0

    def test_idempotent(self) -> None:
        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            auto_link_repos_by_name(self.org, [self.repo.id])
            created = auto_link_repos_by_name(self.org, [self.repo.id])

        assert created == 0
        assert (
            ProjectRepository.objects.filter(project=self.project, repository=self.repo).count()
            == 1
        )


class AutoLinkReposOnProjectCreateTest(TestCase):
    def test_links_matching_repo_on_project_create(self) -> None:
        org = self.create_organization()
        Repository.objects.create(
            organization_id=org.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        project = self.create_project(organization=org, slug="sentry")

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            auto_link_repos_on_project_create(project)

        assert ProjectRepository.objects.filter(
            project=project,
            source=ProjectRepositorySource.AUTO_NAME_MATCH,
        ).exists()

    def test_skips_when_no_matching_repo(self) -> None:
        org = self.create_organization()
        Repository.objects.create(
            organization_id=org.id,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="456",
        )
        project = self.create_project(organization=org, slug="sentry")

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            auto_link_repos_on_project_create(project)

        assert not ProjectRepository.objects.filter(project=project).exists()

    def test_skips_already_linked_repos(self) -> None:
        org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=org.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        other_project = self.create_project(organization=org, slug="other")
        ProjectRepository.objects.create(
            project=other_project,
            repository=repo,
            source=ProjectRepositorySource.MANUAL,
        )
        project = self.create_project(organization=org, slug="sentry")

        with (
            self.feature("organizations:auto-link-repos-by-name"),
            self.options({"repository.auto-link-by-name-dry-run": False}),
        ):
            auto_link_repos_on_project_create(project)

        assert not ProjectRepository.objects.filter(project=project).exists()
