from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository
from sentry.testutils.cases import TestMigrations


class BackfillAutoLinkReposByNameTest(TestMigrations):
    migrate_from = "1102_activity_project_type_index"
    migrate_to = "1103_backfill_auto_link_repos_by_name"

    def setup_before_migration(self, apps):
        Option = apps.get_model("sentry", "Option")

        # Set dry-run to False so the migration actually creates rows
        Option.objects.create(key="repository.auto-link-by-name-dry-run", value=False)

        self.org = self.create_organization()

        # Case 1: exact match — repo basename matches project slug
        self.project_match = self.create_project(organization=self.org, slug="sentry")
        self.repo_match = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="1",
        )

        # Case 2: no match — repo basename doesn't match any project slug
        self.project_nomatch = self.create_project(organization=self.org, slug="frontend")
        self.repo_nomatch = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/relay",
            provider="integrations:github",
            external_id="2",
        )

        # Case 3: repo already linked — should be skipped
        self.project_already_linked = self.create_project(
            organization=self.org, slug="already-linked"
        )
        self.repo_already_linked = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/already-linked",
            provider="integrations:github",
            external_id="3",
        )
        ProjectRepository.objects.create(
            project=self.project_already_linked,
            repository=self.repo_already_linked,
            source=ProjectRepositorySource.MANUAL,
        )

        # Case 4: project already has a link — should be skipped
        self.project_has_link = self.create_project(organization=self.org, slug="has-link")
        other_repo = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/other",
            provider="integrations:github",
            external_id="4",
        )
        ProjectRepository.objects.create(
            project=self.project_has_link,
            repository=other_repo,
            source=ProjectRepositorySource.MANUAL,
        )
        self.repo_for_has_link = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/has-link",
            provider="integrations:github",
            external_id="5",
        )

        # Case 5: GitLab-style name with spaces — should still match
        self.project_gitlab = self.create_project(organization=self.org, slug="my-project")
        self.repo_gitlab = Repository.objects.create(
            organization_id=self.org.id,
            name="My Group / My Project",
            provider="integrations:gitlab",
            external_id="6",
        )

    def test(self) -> None:
        # Case 1: exact match created
        assert ProjectRepository.objects.filter(
            project=self.project_match,
            repository=self.repo_match,
            source=ProjectRepositorySource.AUTO_NAME_MATCH,
        ).exists()

        # Case 2: no match — no link created for either
        assert not ProjectRepository.objects.filter(
            project=self.project_nomatch, repository=self.repo_nomatch
        ).exists()

        # Case 3: already-linked repo — no duplicate created
        assert (
            ProjectRepository.objects.filter(
                project=self.project_already_linked,
                repository=self.repo_already_linked,
            ).count()
            == 1
        )
        # Source should still be MANUAL (not overwritten)
        pr = ProjectRepository.objects.get(
            project=self.project_already_linked,
            repository=self.repo_already_linked,
        )
        assert pr.source == ProjectRepositorySource.MANUAL

        # Case 4: project already has a link — no new link created
        assert not ProjectRepository.objects.filter(
            project=self.project_has_link, repository=self.repo_for_has_link
        ).exists()

        # Case 5: GitLab-style name matched via slugify
        assert ProjectRepository.objects.filter(
            project=self.project_gitlab,
            repository=self.repo_gitlab,
            source=ProjectRepositorySource.AUTO_NAME_MATCH,
        ).exists()
