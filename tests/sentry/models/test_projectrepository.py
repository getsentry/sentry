from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class ProjectRepositoryManagerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)
        self.repo = Repository.objects.create(
            organization_id=self.org.id,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )

    def test_creates_with_source(self) -> None:
        pr, created = ProjectRepository.objects.get_or_create_with_source(
            project_id=self.project.id,
            repository_id=self.repo.id,
            source=ProjectRepositorySource.MANUAL,
        )
        assert created
        assert pr.source == ProjectRepositorySource.MANUAL

    def test_returns_existing_without_upgrade(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.MANUAL,
        )
        pr, created = ProjectRepository.objects.get_or_create_with_source(
            project_id=self.project.id,
            repository_id=self.repo.id,
            source=ProjectRepositorySource.SCM_ONBOARDING,
        )
        assert not created
        pr.refresh_from_db()
        assert pr.source == ProjectRepositorySource.MANUAL

    def test_upgrades_auto_name_match_to_manual(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.AUTO_NAME_MATCH,
        )
        pr, created = ProjectRepository.objects.get_or_create_with_source(
            project_id=self.project.id,
            repository_id=self.repo.id,
            source=ProjectRepositorySource.MANUAL,
        )
        assert not created
        assert pr.source == ProjectRepositorySource.MANUAL

    def test_upgrades_auto_name_match_to_seer_preference(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.AUTO_NAME_MATCH,
        )
        pr, created = ProjectRepository.objects.get_or_create_with_source(
            project_id=self.project.id,
            repository_id=self.repo.id,
            source=ProjectRepositorySource.SEER_PREFERENCE,
        )
        assert not created
        pr.refresh_from_db()
        assert pr.source == ProjectRepositorySource.SEER_PREFERENCE

    def test_upgrades_auto_name_match_to_auto_event(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.AUTO_NAME_MATCH,
        )
        pr, created = ProjectRepository.objects.get_or_create_with_source(
            project_id=self.project.id,
            repository_id=self.repo.id,
            source=ProjectRepositorySource.AUTO_EVENT,
        )
        assert not created
        pr.refresh_from_db()
        assert pr.source == ProjectRepositorySource.AUTO_EVENT

    def test_upgrades_auto_event_to_manual(self) -> None:
        ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.AUTO_EVENT,
        )
        pr, created = ProjectRepository.objects.get_or_create_with_source(
            project_id=self.project.id,
            repository_id=self.repo.id,
            source=ProjectRepositorySource.MANUAL,
        )
        assert not created
        pr.refresh_from_db()
        assert pr.source == ProjectRepositorySource.MANUAL

    def test_does_not_upgrade_auto_name_match_to_auto_name_match(self) -> None:
        pr_original = ProjectRepository.objects.create(
            project=self.project,
            repository=self.repo,
            source=ProjectRepositorySource.AUTO_NAME_MATCH,
        )
        pr, created = ProjectRepository.objects.get_or_create_with_source(
            project_id=self.project.id,
            repository_id=self.repo.id,
            source=ProjectRepositorySource.AUTO_NAME_MATCH,
        )
        assert not created
        pr.refresh_from_db()
        assert pr.source == ProjectRepositorySource.AUTO_NAME_MATCH
        assert pr.date_updated == pr_original.date_updated
