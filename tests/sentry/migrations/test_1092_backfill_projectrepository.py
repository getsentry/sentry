from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import assume_test_silo_mode


class BackfillProjectRepositoryTest(TestMigrations):
    migrate_from = "1091_delete_triggered_incidents_alertruletrigger"
    migrate_to = "1092_backfill_projectrepository"

    def setup_before_migration(self, apps):
        self.org = self.create_organization(owner=self.create_user())
        self.integration = self.create_integration(
            organization=self.org, provider="github", external_id="gh-1"
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.oi = OrganizationIntegration.objects.get(
                organization_id=self.org.id, integration=self.integration
            )
        self.proj = self.create_project(organization=self.org)
        self.repo_a = self.create_repo(
            self.proj,
            name="org/repo-a",
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        self.repo_b = self.create_repo(
            self.proj,
            name="org/repo-b",
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        self.repo_c = self.create_repo(
            self.proj,
            name="org/repo-c",
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        self.repo_d = self.create_repo(
            self.proj,
            name="org/repo-d",
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        self.repo_e = self.create_repo(
            self.proj,
            name="org/repo-e",
            provider="integrations:github",
            integration_id=self.integration.id,
        )

        # Case 1: Auto-generated code mapping only → AUTO_EVENT
        pr_a = ProjectRepository.objects.create(
            project=self.proj,
            repository=self.repo_a,
            source=ProjectRepositorySource.AUTO_EVENT,
        )
        RepositoryProjectPathConfig.objects.create(
            project=self.proj,
            repository=self.repo_a,
            organization_integration_id=self.oi.id,
            organization_id=self.org.id,
            integration_id=self.integration.id,
            stack_root="src/",
            source_root="src/",
            automatically_generated=True,
            project_repository=pr_a,
        )

        # Case 2: Manual code mapping only → MANUAL
        pr_b = ProjectRepository.objects.create(
            project=self.proj,
            repository=self.repo_b,
            source=ProjectRepositorySource.MANUAL,
        )
        RepositoryProjectPathConfig.objects.create(
            project=self.proj,
            repository=self.repo_b,
            organization_integration_id=self.oi.id,
            organization_id=self.org.id,
            integration_id=self.integration.id,
            stack_root="lib/",
            source_root="lib/",
            automatically_generated=False,
            project_repository=pr_b,
        )

        # Case 3: Seer preference only → SEER_PREFERENCE
        pr_c = ProjectRepository.objects.create(
            project=self.proj,
            repository=self.repo_c,
            source=ProjectRepositorySource.SEER_PREFERENCE,
        )
        SeerProjectRepository.objects.create(
            project=self.proj,
            repository=self.repo_c,
            project_repository=pr_c,
            branch_name="main",
        )

        # Case 4: Both manual code mapping AND Seer preference for same
        # (project, repo) → SEER_PREFERENCE wins (higher priority).
        pr_d = ProjectRepository.objects.create(
            project=self.proj,
            repository=self.repo_d,
            source=ProjectRepositorySource.SEER_PREFERENCE,
        )
        RepositoryProjectPathConfig.objects.create(
            project=self.proj,
            repository=self.repo_d,
            organization_integration_id=self.oi.id,
            organization_id=self.org.id,
            integration_id=self.integration.id,
            stack_root="app/",
            source_root="app/",
            automatically_generated=False,
            project_repository=pr_d,
        )
        SeerProjectRepository.objects.create(
            project=self.proj,
            repository=self.repo_d,
            project_repository=pr_d,
            branch_name="develop",
        )

        # Case 5: Dual-write already created a ProjectRepository row.
        # The migration should not duplicate it, and should still backfill
        # the FK on the code mapping.
        self.existing_pr = ProjectRepository.objects.create(
            project=self.proj,
            repository=self.repo_e,
            source=ProjectRepositorySource.MANUAL,
        )
        RepositoryProjectPathConfig.objects.create(
            project=self.proj,
            repository=self.repo_e,
            organization_integration_id=self.oi.id,
            organization_id=self.org.id,
            integration_id=self.integration.id,
            stack_root="pkg/",
            source_root="pkg/",
            automatically_generated=True,
            project_repository=self.existing_pr,
        )

    def test(self) -> None:
        def get_pr(repo):
            return ProjectRepository.objects.get(project=self.proj, repository=repo)

        # Case 1: auto-generated code mapping → AUTO_EVENT
        pr_a = get_pr(self.repo_a)
        assert pr_a.source == ProjectRepositorySource.AUTO_EVENT

        # Case 2: manual code mapping → MANUAL
        pr_b = get_pr(self.repo_b)
        assert pr_b.source == ProjectRepositorySource.MANUAL

        # Case 3: Seer preference only → SEER_PREFERENCE
        pr_c = get_pr(self.repo_c)
        assert pr_c.source == ProjectRepositorySource.SEER_PREFERENCE

        # Case 4: both manual code mapping and Seer → SEER_PREFERENCE wins
        pr_d = get_pr(self.repo_d)
        assert pr_d.source == ProjectRepositorySource.SEER_PREFERENCE

        # Case 5: pre-existing ProjectRepository from dual-write is preserved
        pr_e = get_pr(self.repo_e)
        assert pr_e.id == self.existing_pr.id

        # All RepositoryProjectPathConfig rows have project_repository_id set
        assert (
            RepositoryProjectPathConfig.objects.filter(
                project_repository__project=self.proj, project_repository_id__isnull=True
            ).count()
            == 0
        )

        # All SeerProjectRepository rows have project_repository_id set
        assert (
            SeerProjectRepository.objects.filter(
                project_repository__project=self.proj, project_repository_id__isnull=True
            ).count()
            == 0
        )

        # FK consistency: each row's project_repository points to the right pair
        for config in RepositoryProjectPathConfig.objects.filter(
            project_repository__project=self.proj
        ):
            pr = ProjectRepository.objects.get(id=config.project_repository_id)
            assert pr.project_id == config.project_repository.project_id
            assert pr.repository_id == config.project_repository.repository_id

        for spr in SeerProjectRepository.objects.filter(project_repository__project=self.proj):
            pr = ProjectRepository.objects.get(id=spr.project_repository_id)
            assert pr.project_id == spr.project_repository.project_id
            assert pr.repository_id == spr.project_repository.repository_id
