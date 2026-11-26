import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.db import connections, router, transaction

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import dispatch_to_local_service
from sentry.integrations.services.repository.model import (
    RpcRepository,
    RpcRepositoryRename,
)
from sentry.integrations.services.repository.serial import serialize_repository
from sentry.integrations.services.repository.service import repository_service
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase, TransactionTestCase
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


@all_silo_test
class GetRepositoriesTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="1",
            provider="github",
        )
        self.provider = "integrations:github"
        self.first_repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            external_id="100",
            provider=self.provider,
            integration_id=self.integration.id,
        )
        self.second_repo = self.create_repo(
            project=self.project,
            name="getsentry/snuba",
            external_id="200",
            provider=self.provider,
            integration_id=self.integration.id,
        )
        self.create_repo(
            project=self.project,
            name="getsentry/relay",
            external_id="300",
            provider=self.provider,
            integration_id=self.integration.id,
        )

    def test_filters_by_external_ids(self) -> None:
        repositories = repository_service.get_repositories(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_ids=["100", "200"],
            providers=[self.provider],
        )

        assert {repo.id for repo in repositories} == {self.first_repo.id, self.second_repo.id}

    def test_empty_external_ids_returns_no_repositories(self) -> None:
        assert (
            repository_service.get_repositories(
                organization_id=self.organization.id,
                external_ids=[],
            )
            == []
        )

    def test_external_ids_survive_rpc_serialization(self) -> None:
        response = dispatch_to_local_service(
            "repository",
            "get_repositories",
            {
                "organization_id": self.organization.id,
                "external_ids": ["200"],
            },
        )

        assert [repo["id"] for repo in response["value"]] == [self.second_repo.id]


@cell_silo_test
class GetRepositoriesValidationTest(TestCase):
    def test_rejects_singular_and_plural_external_id_filters(self) -> None:
        with pytest.raises(
            ValueError,
            match="external_id and external_ids cannot both be provided",
        ):
            repository_service.get_repositories(
                organization_id=self.organization.id,
                external_id="100",
                external_ids=["100"],
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
        org_integration = self.integration.organizationintegration_set.first()
        assert org_integration is not None
        self.org_integration = org_integration

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
class RenameRepositoriesTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization, external_id="1", provider="github"
        )
        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/old-name",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="100",
            url="https://github.com/getsentry/old-name",
        )
        self.repo.update(config={"name": "getsentry/old-name", "other": "kept"})

    def _rename_request(self, **overrides: Any) -> RpcRepositoryRename:
        rename = {
            "id": self.repo.id,
            "external_id": "100",
            "expected_name": "getsentry/old-name",
            "expected_url": "https://github.com/getsentry/old-name",
            "expected_config_name": "getsentry/old-name",
            "name": "getsentry/new-name",
            "url": "https://github.com/getsentry/new-name",
            **overrides,
        }
        return RpcRepositoryRename(**rename)

    def _rename(self, **overrides: Any) -> list[int]:
        return repository_service.rename_repositories(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider="integrations:github",
            renames=[self._rename_request(**overrides)],
        )

    def test_writes_only_rename_fields_to_current_row(self) -> None:
        # Written after the caller read the repo; the rename must keep it.
        self.repo.update(config={**self.repo.config, "webhook_id": 10})

        assert self._rename() == [self.repo.id]

        self.repo.refresh_from_db()
        assert self.repo.name == "getsentry/new-name"
        assert self.repo.url == "https://github.com/getsentry/new-name"
        assert self.repo.config == {"name": "getsentry/new-name", "other": "kept", "webhook_id": 10}
        assert self.repo.status == ObjectStatus.ACTIVE

    def test_renames_disabled_repository(self) -> None:
        self.repo.update(status=ObjectStatus.DISABLED)

        assert self._rename() == [self.repo.id]

        self.repo.refresh_from_db()
        assert self.repo.name == "getsentry/new-name"
        assert self.repo.status == ObjectStatus.DISABLED

    def test_skips_repository_pending_deletion(self) -> None:
        self.repo.update(status=ObjectStatus.PENDING_DELETION)

        assert self._rename() == []

        self.repo.refresh_from_db()
        assert self.repo.name == "getsentry/old-name"
        assert self.repo.status == ObjectStatus.PENDING_DELETION

    def test_skips_repository_moved_to_another_integration(self) -> None:
        other_integration = self.create_integration(
            organization=self.organization, external_id="2", provider="github"
        )
        self.repo.update(integration_id=other_integration.id)

        assert self._rename() == []

        self.repo.refresh_from_db()
        assert self.repo.name == "getsentry/old-name"
        assert self.repo.integration_id == other_integration.id

    def test_skips_repository_with_another_external_id(self) -> None:
        assert self._rename(external_id="200") == []

        self.repo.refresh_from_db()
        assert self.repo.name == "getsentry/old-name"

    def test_skips_unchanged_repository(self) -> None:
        assert (
            self._rename(name="getsentry/old-name", url="https://github.com/getsentry/old-name")
            == []
        )

    def test_renames_repository_with_null_url(self) -> None:
        self.repo.update(url=None)

        assert self._rename(expected_url=None) == [self.repo.id]

        self.repo.refresh_from_db()
        assert self.repo.url == "https://github.com/getsentry/new-name"

    def test_batch_applies_first_matching_rename_per_repository(self) -> None:
        self.repo.update(config={"other": True})
        other = self.create_repo(
            project=self.project,
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="101",
            name="example/second",
            url=None,
        )
        other.update(config={"name": None})
        renames = [
            self._rename_request(
                id=other.id,
                external_id="101",
                expected_name=other.name,
                expected_url=None,
                expected_config_name=None,
                name="example/renamed",
                url="https://example.com/renamed",
            ),
            # A stale entry for the same ID must not supply the new name or URL.
            self._rename_request(name="example/stale", url="https://example.com/stale"),
            self._rename_request(expected_config_name=None),
            # This only matches after the previous rename; don't rename the row twice.
            self._rename_request(
                expected_name="getsentry/new-name",
                expected_url="https://github.com/getsentry/new-name",
                expected_config_name="getsentry/new-name",
                name="example/chained",
                url="https://example.com/chained",
            ),
        ]

        renamed = repository_service.rename_repositories(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider="integrations:github",
            renames=renames,
        )

        assert renamed == [self.repo.id, other.id]
        self.repo.refresh_from_db()
        other.refresh_from_db()
        assert (self.repo.name, self.repo.url) == (renames[2].name, renames[2].url)
        assert self.repo.config == {"name": renames[2].name, "other": True}
        assert (other.name, other.url) == (renames[0].name, renames[0].url)
        assert other.config == {"name": renames[0].name}

    def test_renames_only_matching_rows_in_batch(self) -> None:
        other = self.create_repo(
            project=self.project,
            name="getsentry/other",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="101",
            url="https://github.com/getsentry/other",
        )
        other.update(config={"name": "getsentry/other"})

        renamed = repository_service.rename_repositories(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider="integrations:github",
            renames=[
                RpcRepositoryRename(
                    id=self.repo.id,
                    external_id="100",
                    expected_name="getsentry/old-name",
                    expected_url="https://github.com/getsentry/old-name",
                    expected_config_name="getsentry/old-name",
                    name="getsentry/new-name",
                    url="https://github.com/getsentry/new-name",
                ),
                # Stale: the caller read a name the row no longer has.
                RpcRepositoryRename(
                    id=other.id,
                    external_id="101",
                    expected_name="getsentry/older",
                    expected_url="https://github.com/getsentry/other",
                    expected_config_name="getsentry/other",
                    name="getsentry/other-new",
                    url="https://github.com/getsentry/other-new",
                ),
            ],
        )

        assert renamed == [self.repo.id]
        other.refresh_from_db()
        assert other.name == "getsentry/other"

    def test_skips_repository_changed_since_caller_read_it(self) -> None:
        # A webhook renamed the repo after the sync queued its rename.
        self.repo.update(
            name="getsentry/newest-name",
            url="https://github.com/getsentry/newest-name",
            config={**self.repo.config, "name": "getsentry/newest-name"},
        )

        assert self._rename() == []

        self.repo.refresh_from_db()
        assert self.repo.name == "getsentry/newest-name"
        assert self.repo.url == "https://github.com/getsentry/newest-name"
        assert self.repo.config["name"] == "getsentry/newest-name"

    def test_skips_repository_whose_config_name_changed(self) -> None:
        self.repo.update(config={**self.repo.config, "name": "getsentry/newest-name"})

        assert self._rename() == []

        self.repo.refresh_from_db()
        assert self.repo.name == "getsentry/old-name"
        assert self.repo.config["name"] == "getsentry/newest-name"


@cell_silo_test
class EnableRepositoriesByExternalIdsTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization, external_id="1", provider="github"
        )

    def _create_repo(self, external_id: str, status: int) -> Repository:
        repo = self.create_repo(
            project=self.project,
            name=f"getsentry/repo-{external_id}",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id=external_id,
        )
        repo.update(status=status)
        return repo

    def _enable(self, external_ids: list[str]) -> list[RpcRepository]:
        return repository_service.enable_repositories_by_external_ids(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            provider="integrations:github",
            external_ids=external_ids,
        )

    def test_enables_disabled_and_returns_active_repositories(self) -> None:
        disabled = self._create_repo("1", ObjectStatus.DISABLED)
        pending_deletion = self._create_repo("2", ObjectStatus.PENDING_DELETION)
        # Already active, for example enabled by an earlier attempt that failed later.
        active = self._create_repo("3", ObjectStatus.ACTIVE)

        result = self._enable(["1", "2", "3"])

        assert [repo.id for repo in result] == [disabled.id, active.id]
        assert {repo.status for repo in result} == {ObjectStatus.ACTIVE}
        disabled.refresh_from_db()
        pending_deletion.refresh_from_db()
        active.refresh_from_db()
        assert disabled.status == ObjectStatus.ACTIVE
        assert pending_deletion.status == ObjectStatus.PENDING_DELETION
        assert active.status == ObjectStatus.ACTIVE

    def test_keeps_concurrent_rename(self) -> None:
        repo = self._create_repo("1", ObjectStatus.DISABLED)
        # Renamed after the caller decided to restore the repo.
        repo.update(name="getsentry/new-name", config={"name": "getsentry/new-name"})

        result = self._enable(["1"])

        assert result[0].name == "getsentry/new-name"
        repo.refresh_from_db()
        assert repo.status == ObjectStatus.ACTIVE
        assert repo.name == "getsentry/new-name"
        assert repo.config == {"name": "getsentry/new-name"}

    def test_skips_other_integration(self) -> None:
        other = self.create_integration(
            organization=self.organization, external_id="2", provider="github"
        )
        repo = self._create_repo("1", ObjectStatus.DISABLED)
        repo.update(integration_id=other.id)

        assert self._enable(["1"]) == []

        repo.refresh_from_db()
        assert repo.status == ObjectStatus.DISABLED


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

    def test_updates_and_deletes_config_keys(self) -> None:
        assert self._update(
            config_deletions=["project_id"],
            expected_config={"webhook_id": 10, "project_id": 1},
        )

        self.repo.refresh_from_db()
        assert self.repo.config == {"webhook_id": 20}

    def test_deletion_wins_over_update(self) -> None:
        assert self._update(config_deletions=["webhook_id"])

        self.repo.refresh_from_db()
        assert self.repo.config == {"project_id": 1}

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


@contextmanager
def _row_locked_elsewhere(repo_id: int) -> Iterator[None]:
    """Hold a row lock on a repository from another connection, then release it."""
    using = router.db_for_write(Repository)
    locked = threading.Event()
    release = threading.Event()
    errors: list[BaseException] = []

    def hold_lock() -> None:
        try:
            with transaction.atomic(using=using):
                Repository.objects.using(using).select_for_update().get(id=repo_id)
                locked.set()
                release.wait(10)
        except BaseException as e:
            errors.append(e)
        finally:
            locked.set()
            connections[using].close()

    thread = threading.Thread(target=hold_lock)
    thread.start()
    try:
        assert locked.wait(10)
        with connections[using].cursor() as cursor:
            # Fail fast instead of hanging if the call waits on the held lock.
            cursor.execute("SET lock_timeout = '2s'")
        try:
            yield
        finally:
            with connections[using].cursor() as cursor:
                cursor.execute("RESET lock_timeout")
    finally:
        release.set()
        thread.join(10)
    if errors:
        raise errors[0]


@cell_silo_test
class RepositoryWriteLockTest(TransactionTestCase):
    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization, external_id="1", provider="github"
        )

    def _create_repo(self, external_id: str, status: int) -> Repository:
        repo = self.create_repo(
            project=self.project,
            name=f"getsentry/repo-{external_id}",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id=external_id,
            url=f"https://github.com/getsentry/repo-{external_id}",
        )
        repo.update(status=status, config={"name": f"getsentry/repo-{external_id}"})
        return repo

    def _call_with_lock_held(self, repo: Repository, call: Callable[[], Any]) -> Any:
        with _row_locked_elsewhere(repo.id):
            return call()

    def test_enable_does_not_wait_on_locked_active_repository(self) -> None:
        active = self._create_repo("1", ObjectStatus.ACTIVE)
        disabled = self._create_repo("2", ObjectStatus.DISABLED)

        result = self._call_with_lock_held(
            active,
            lambda: repository_service.enable_repositories_by_external_ids(
                organization_id=self.organization.id,
                integration_id=self.integration.id,
                provider="integrations:github",
                external_ids=["1", "2"],
            ),
        )

        assert [repo.id for repo in result] == [active.id, disabled.id]
        disabled.refresh_from_db()
        assert disabled.status == ObjectStatus.ACTIVE

    def test_rename_does_not_wait_on_locked_repository_it_skips(self) -> None:
        unchanged = self._create_repo("1", ObjectStatus.ACTIVE)
        renamed = self._create_repo("2", ObjectStatus.ACTIVE)

        def rename(repo: Repository, name: str) -> RpcRepositoryRename:
            return RpcRepositoryRename(
                id=repo.id,
                external_id=repo.external_id,
                expected_name=repo.name,
                expected_url=repo.url,
                expected_config_name=repo.config["name"],
                name=name,
                url=f"https://github.com/{name}",
            )

        result = self._call_with_lock_held(
            unchanged,
            lambda: repository_service.rename_repositories(
                organization_id=self.organization.id,
                integration_id=self.integration.id,
                provider="integrations:github",
                renames=[rename(unchanged, unchanged.name), rename(renamed, "getsentry/new-name")],
            ),
        )

        assert result == [renamed.id]
        renamed.refresh_from_db()
        assert renamed.name == "getsentry/new-name"
        assert renamed.config == {"name": "getsentry/new-name"}
