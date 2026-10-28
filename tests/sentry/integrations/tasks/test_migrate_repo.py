from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.integrations.tasks.migrate_repo import migrate_repo
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
@patch(
    "sentry.integrations.bitbucket_server.integration.BitbucketServerIntegration.has_repo_access",
    return_value=True,
)
@patch("sentry.integrations.tasks.migrate_repo.get_integration_repository_provider")
class MigrateRepoTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="bitbucket_server",
            external_id="bitbucket.example.com:sentry-test",
            metadata={"base_url": "https://bitbucket.example.com", "verify_ssl": False},
        )

    def create_legacy_repo(self, status: int) -> Repository:
        with assume_test_silo_mode(SiloMode.CELL):
            return Repository.objects.create(
                organization_id=self.organization.id,
                name="sentryuser/newsdiffs",
                provider="bitbucket_server",
                external_id="1",
                config={"project": "sentryuser", "repo": "newsdiffs"},
                status=status,
            )

    def migrate(self, repo: Repository) -> None:
        migrate_repo(
            repo_id=repo.id,
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

    def test_reactivated_repo_runs_on_create(
        self, mock_get_provider: MagicMock, _: MagicMock
    ) -> None:
        repo = self.create_legacy_repo(ObjectStatus.DISABLED)

        self.migrate(repo)

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE
        assert repo.integration_id == self.integration.id
        on_create = mock_get_provider.return_value.on_create_repository
        on_create.assert_called_once()
        assert on_create.call_args.args[0].id == repo.id

    def test_repo_pending_deletion_skips_on_create(
        self, mock_get_provider: MagicMock, _: MagicMock
    ) -> None:
        repo = self.create_legacy_repo(ObjectStatus.PENDING_DELETION)

        self.migrate(repo)

        with assume_test_silo_mode(SiloMode.CELL):
            repo.refresh_from_db()
        assert repo.status == ObjectStatus.PENDING_DELETION
        mock_get_provider.return_value.on_create_repository.assert_not_called()
