from unittest.mock import MagicMock, patch

import pytest

from sentry.constants import ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.repository.service import repository_service
from sentry.models.repository import Repository
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class DisableRepositoriesByExternalIdsTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"

    @patch("sentry.integrations.services.repository.impl.bulk_cleanup_seer_repository_preferences")
    def test_disables_matching_active_repos(self, mock_seer_cleanup: MagicMock) -> None:
        repo1 = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        repo2 = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/snuba",
            external_id="200",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100", "200"],
        )

        repo1.refresh_from_db()
        repo2.refresh_from_db()
        assert repo1.status == ObjectStatus.DISABLED
        assert repo2.status == ObjectStatus.DISABLED

    def test_does_not_disable_already_disabled_repos(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.DISABLED,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.DISABLED

    def test_does_not_affect_repos_from_other_integrations(self) -> None:
        other_integration = self.create_integration(
            organization=self.organization,
            external_id="2",
            provider="github",
        )
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=other_integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE

    def test_does_not_affect_repos_from_other_orgs(self) -> None:
        other_org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=other_org.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE

    @patch("sentry.integrations.services.repository.impl.bulk_cleanup_seer_repository_preferences")
    def test_only_disables_specified_external_ids(self, mock_seer_cleanup: MagicMock) -> None:
        repo_to_disable = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        repo_to_keep = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/snuba",
            external_id="200",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo_to_disable.refresh_from_db()
        repo_to_keep.refresh_from_db()
        assert repo_to_disable.status == ObjectStatus.DISABLED
        assert repo_to_keep.status == ObjectStatus.ACTIVE

    def test_empty_external_ids_is_noop(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=[],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.integrations.services.repository.impl.bulk_cleanup_seer_repository_preferences")
    def test_cleans_up_seer_preferences(self, mock_cleanup: MagicMock) -> None:
        project = self.create_project(organization=self.organization)
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        SeerProjectRepository.objects.create(project=project, repository_id=repo.id)

        repository_service.disable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
            external_ids=["100"],
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.DISABLED

        assert not SeerProjectRepository.objects.filter(repository_id=repo.id).exists()
        mock_cleanup.apply_async.assert_called_once_with(
            kwargs={
                "organization_id": self.organization.id,
                "repos": [{"repo_external_id": "100", "repo_provider": self.provider}],
            }
        )


@cell_silo_test
class DisableRepositoriesForIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"

    @patch("sentry.integrations.services.repository.impl.bulk_cleanup_seer_repository_preferences")
    def test_disables_matching_active_repos(self, mock_seer_cleanup: MagicMock) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disable_repositories_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.DISABLED

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.integrations.services.repository.impl.bulk_cleanup_seer_repository_preferences")
    def test_cleans_up_seer_preferences(self, mock_cleanup: MagicMock) -> None:
        project = self.create_project(organization=self.organization)
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        SeerProjectRepository.objects.create(project=project, repository_id=repo.id)

        repository_service.disable_repositories_for_integration(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider=self.provider,
        )

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.DISABLED

        assert not SeerProjectRepository.objects.filter(repository_id=repo.id).exists()
        mock_cleanup.apply_async.assert_called_once_with(
            kwargs={
                "organization_id": self.organization.id,
                "repos": [{"repo_external_id": "100", "repo_provider": self.provider}],
            }
        )


@cell_silo_test
class DisassociateOrganizationIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"
        self.org_integration = self.integration.organizationintegration_set.first()

    @patch("sentry.integrations.services.repository.impl.bulk_cleanup_seer_repository_preferences")
    def test_disassociates_repos(self, mock_cleanup: MagicMock) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        repository_service.disassociate_organization_integration(
            organization_id=self.organization.id,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
        )

        repo.refresh_from_db()
        assert repo.integration_id is None
        mock_cleanup.apply_async.assert_called_once()

    @with_feature("organizations:seer-project-settings-dual-write")
    @patch("sentry.integrations.services.repository.impl.bulk_cleanup_seer_repository_preferences")
    def test_cleans_up_seer_preferences(self, mock_cleanup: MagicMock) -> None:
        project = self.create_project(organization=self.organization)
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )
        SeerProjectRepository.objects.create(project=project, repository_id=repo.id)

        repository_service.disassociate_organization_integration(
            organization_id=self.organization.id,
            organization_integration_id=self.org_integration.id,
            integration_id=self.integration.id,
        )

        repo.refresh_from_db()
        assert repo.integration_id is None
        assert not SeerProjectRepository.objects.filter(repository_id=repo.id).exists()
        mock_cleanup.apply_async.assert_called_once_with(
            kwargs={
                "organization_id": self.organization.id,
                "repos": [{"repo_external_id": "100", "repo_provider": self.provider}],
            }
        )

    @patch("sentry.integrations.services.repository.impl.bulk_cleanup_seer_repository_preferences")
    def test_transaction_rollback_does_not_dispatch_seer_cleanup(
        self, mock_cleanup: MagicMock
    ) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        with patch.object(
            RepositoryProjectPathConfig.objects,
            "filter",
            side_effect=RuntimeError("simulated failure"),
        ):
            with pytest.raises(RuntimeError):
                repository_service.disassociate_organization_integration(
                    organization_id=self.organization.id,
                    organization_integration_id=self.org_integration.id,
                    integration_id=self.integration.id,
                )

        # Transaction rolled back: repo should still have its integration
        repo.refresh_from_db()
        assert repo.integration_id == self.integration.id

        # Task should not have been dispatched
        mock_cleanup.apply_async.assert_not_called()
