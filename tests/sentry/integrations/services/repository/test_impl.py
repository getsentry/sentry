from typing import Any
from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import dispatch_to_local_service
from sentry.integrations.services.repository.serial import serialize_repository
from sentry.integrations.services.repository.service import repository_service
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, cell_silo_test


@all_silo_test
class ScheduleGitlabProjectWebhooksTest(TestCase):
    @patch("sentry.integrations.services.repository.impl.update_all_project_webhooks.delay")
    def test_force_is_forwarded(self, delay: MagicMock) -> None:
        repository_service.schedule_update_gitlab_project_webhooks(
            organization_id=self.organization.id, integration_id=123, force=True
        )
        delay.assert_called_once_with(
            organization_id=self.organization.id, integration_id=123, force=True
        )

    @patch("sentry.integrations.services.repository.impl.update_all_project_webhooks.delay")
    def test_older_callers_default_to_debounce(self, delay: MagicMock) -> None:
        repository_service.schedule_update_gitlab_project_webhooks(
            organization_id=self.organization.id, integration_id=123
        )
        delay.assert_called_once_with(
            organization_id=self.organization.id, integration_id=123, force=False
        )

    @patch("sentry.integrations.services.repository.impl.update_all_project_webhooks.delay")
    def test_force_survives_serialization(self, delay: MagicMock) -> None:
        dispatch_to_local_service(
            "repository",
            "schedule_update_gitlab_project_webhooks",
            {"organization_id": self.organization.id, "integration_id": 123, "force": True},
        )
        delay.assert_called_once_with(
            organization_id=self.organization.id, integration_id=123, force=True
        )


@cell_silo_test
class DisableRepositoriesByExternalIdsTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"

    def test_disables_matching_active_repos(self) -> None:
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

    def test_only_disables_specified_external_ids(self) -> None:
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


@cell_silo_test
class DisableRepositoriesForIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"

    def test_disables_matching_active_repos(self) -> None:
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

    def test_disassociates_repos(self) -> None:
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


@cell_silo_test
class TransferRepositoryToIntegrationTest(TestCase):
    def setUp(self) -> None:
        self.provider = "integrations:github"
        self.old_integration = self.create_integration(
            organization=self.organization, external_id="1", provider="github"
        )
        self.old_org_integration = self.old_integration.organizationintegration_set.get()
        self.new_integration = self.create_integration(
            organization=self.organization, external_id="2", provider="github"
        )
        self.new_org_integration = self.new_integration.organizationintegration_set.get()
        self.repo = self.create_repo(
            project=self.project,
            name="old-org/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.old_integration.id,
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
            repo=self.repo,
            organization_integration=self.old_org_integration,
        )

    def _transfer(self) -> bool:
        update = serialize_repository(self.repo)
        update.name = "new-org/sentry"
        update.integration_id = self.new_integration.id
        update.status = ObjectStatus.ACTIVE
        return repository_service.transfer_repository_to_integration(
            organization_id=self.organization.id,
            update=update,
            organization_integration_id=self.new_org_integration.id,
        )

    def test_moves_repo_and_code_mappings(self) -> None:
        assert self._transfer() is True

        self.repo.refresh_from_db()
        assert self.repo.integration_id == self.new_integration.id
        assert self.repo.name == "new-org/sentry"
        self.code_mapping.refresh_from_db()
        assert self.code_mapping.integration_id == self.new_integration.id
        assert self.code_mapping.organization_integration_id == self.new_org_integration.id

    def test_returns_false_when_repo_deleted(self) -> None:
        update = serialize_repository(self.repo)
        self.repo.delete()

        assert (
            repository_service.transfer_repository_to_integration(
                organization_id=self.organization.id,
                update=update,
                organization_integration_id=self.new_org_integration.id,
            )
            is False
        )
        assert not Repository.objects.filter(id=update.id).exists()

    def test_returns_false_when_repo_pending_deletion(self) -> None:
        Repository.objects.filter(id=self.repo.id).update(status=ObjectStatus.PENDING_DELETION)

        assert self._transfer() is False

        self.repo.refresh_from_db()
        assert self.repo.status == ObjectStatus.PENDING_DELETION
        assert self.repo.integration_id == self.old_integration.id
        assert self.repo.name == "old-org/sentry"
        self.code_mapping.refresh_from_db()
        assert self.code_mapping.integration_id == self.old_integration.id
        assert self.code_mapping.organization_integration_id == self.old_org_integration.id


@cell_silo_test
class UpdateRepositoryConfigTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization, external_id="1", provider="gitlab"
        )
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:gitlab",
            integration_id=self.integration.id,
        )
        self.repo.update(config={"project_id": 1, "webhook_id": 10})

    def _update(self, **kwargs: Any) -> bool:
        return repository_service.update_repository_config(
            organization_id=self.organization.id,
            id=self.repo.id,
            config_updates={"webhook_id": 20},
            **kwargs,
        )

    def test_merges_only_the_given_keys(self) -> None:
        # Written after the caller's snapshot; a full-row write would drop it.
        self.repo.update(name="renamed", config={**self.repo.config, "sync_comments": True})

        assert self._update(
            expected_integration_id=self.integration.id, expected_config={"webhook_id": 10}
        )

        self.repo.refresh_from_db()
        assert self.repo.name == "renamed"
        assert self.repo.config == {"project_id": 1, "webhook_id": 20, "sync_comments": True}

    def test_refuses_inactive_repository(self) -> None:
        for status in (ObjectStatus.DISABLED, ObjectStatus.PENDING_DELETION):
            self.repo.update(status=status)

            assert self._update() is False

            self.repo.refresh_from_db()
            assert self.repo.status == status
            assert self.repo.config["webhook_id"] == 10

    def test_refuses_repository_moved_to_another_integration(self) -> None:
        other = self.create_integration(
            organization=self.organization, external_id="2", provider="gitlab"
        )
        self.repo.update(integration_id=other.id)

        assert self._update(expected_integration_id=self.integration.id) is False

        self.repo.refresh_from_db()
        assert self.repo.integration_id == other.id
        assert self.repo.config["webhook_id"] == 10

    def test_refuses_changed_expected_config(self) -> None:
        assert self._update(expected_config={"webhook_id": 9}) is False
        assert self._update(expected_config={"webhook_id": None}) is False

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 10

    def test_none_expects_an_unset_key(self) -> None:
        assert self._update(expected_config={"missing": None}) is True

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 20

    def test_refuses_repository_in_other_organization(self) -> None:
        other_org = self.create_organization()

        assert (
            repository_service.update_repository_config(
                organization_id=other_org.id, id=self.repo.id, config_updates={"webhook_id": 20}
            )
            is False
        )

        self.repo.refresh_from_db()
        assert self.repo.config["webhook_id"] == 10


@cell_silo_test
class SerializeRepositoryTest(TestCase):
    def test_returns_repository_in_same_organization(self) -> None:
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="getsentry/sentry",
            external_id="100",
            provider="integrations:github",
        )

        result = repository_service.serialize_repository(
            organization_id=self.organization.id,
            id=repo.id,
        )

        assert result is not None
        assert result["id"] == str(repo.id)

    def test_returns_none_for_repository_in_other_organization(self) -> None:
        other_org = self.create_organization()
        repo = Repository.objects.create(
            organization_id=other_org.id,
            name="getsentry/sentry",
            external_id="100",
            provider="integrations:github",
        )

        result = repository_service.serialize_repository(
            organization_id=self.organization.id,
            id=repo.id,
        )

        assert result is None
