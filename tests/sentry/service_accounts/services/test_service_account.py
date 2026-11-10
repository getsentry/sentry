import pytest
from django.db import router, transaction

from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.hybridcloud.rpc.service import RpcValidationException
from sentry.service_accounts.models import (
    ServiceAccount,
    ServiceAccountProject,
    ServiceAccountProjectReplica,
    ServiceAccountReplica,
)
from sentry.service_accounts.outbox import service_account_grant_update_outbox
from sentry.service_accounts.services.service_account import service_account_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@all_silo_test
class ServiceAccountServiceTest(TestCase):
    def project_ids(self, service_account_id: int) -> list[int]:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return sorted(
                ServiceAccountProject.objects.filter(
                    service_account_id=service_account_id
                ).values_list("project_id", flat=True)
            )

    def replica_project_ids(self, service_account_id: int) -> list[int]:
        with assume_test_silo_mode(SiloMode.CELL):
            return sorted(
                ServiceAccountProjectReplica.objects.filter(
                    service_account__service_account_id=service_account_id
                ).values_list("project_id", flat=True)
            )

    def create(self) -> int:
        with outbox_runner():
            return service_account_service.create_service_account(
                organization_id=self.organization.id,
                name="seer-agent",
                scope_list=["event:read"],
                project_ids=[self.project.id],
                all_projects=False,
                created_by_id=self.user.id,
            ).id

    def queue_grant_update(
        self, service_account_id: int, scope_list: list[str], *, all_projects: bool = False
    ) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            with outbox_context(transaction.atomic(router.db_for_write(CellOutbox))):
                service_account_grant_update_outbox(
                    organization_id=self.organization.id,
                    service_account_id=service_account_id,
                    scope_list=scope_list,
                    all_projects=all_projects,
                ).save()

    def test_create_service_account(self) -> None:
        with outbox_runner():
            account = service_account_service.create_service_account(
                organization_id=self.organization.id,
                name="seer-agent",
                scope_list=["event:read", "project:read"],
                project_ids=[self.project.id],
                all_projects=False,
                created_by_id=self.user.id,
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            stored = ServiceAccount.objects.get(id=account.id)
        assert account.organization_id == stored.organization_id == self.organization.id
        assert account.name == stored.name == "seer-agent"
        assert account.scope_list == stored.scope_list == ["event:read", "project:read"]
        assert account.is_active is stored.is_active is True
        assert account.all_projects is stored.all_projects is False
        assert account.project_ids == self.project_ids(account.id) == [self.project.id]
        assert stored.created_by_id == self.user.id
        with assume_test_silo_mode(SiloMode.CELL):
            assert ServiceAccountReplica.objects.filter(service_account_id=account.id).exists()

    def test_create_returns_deduplicated_project_ids(self) -> None:
        with outbox_runner():
            account = service_account_service.create_service_account(
                organization_id=self.organization.id,
                name="seer-agent",
                scope_list=["event:read"],
                project_ids=[self.project.id, self.project.id],
                all_projects=False,
                created_by_id=None,
            )

        assert account.project_ids == self.project_ids(account.id) == [self.project.id]

    def test_create_all_projects_ignores_listed_projects(self) -> None:
        with outbox_runner():
            account = service_account_service.create_service_account(
                organization_id=self.organization.id,
                name="seer-agent",
                scope_list=["event:read"],
                project_ids=[self.project.id],
                all_projects=True,
                created_by_id=None,
            )

        assert account.all_projects
        assert account.project_ids == self.project_ids(account.id) == []

    def test_create_duplicate_name_raises_validation_error(self) -> None:
        self.create()

        with pytest.raises(RpcValidationException):
            service_account_service.create_service_account(
                organization_id=self.organization.id,
                name="seer-agent",
                scope_list=["event:read"],
                project_ids=[],
                all_projects=False,
                created_by_id=None,
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.filter(organization_id=self.organization.id).count() == 1

    def test_create_with_same_idempotency_key_returns_first_account(self) -> None:
        def create(name: str) -> int:
            return service_account_service.create_service_account(
                organization_id=self.organization.id,
                name=name,
                scope_list=["event:read"],
                project_ids=[self.project.id],
                all_projects=False,
                created_by_id=None,
                idempotency_key="retry-key",
            ).id

        first = create("seer-agent")
        # A retry with the same key returns the first account even when its name changed.
        assert create("seer-agent-renamed") == first
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.get(organization_id=self.organization.id).id == first
        assert self.project_ids(first) == [self.project.id]

    def test_create_ungrantable_scope_raises_validation_error(self) -> None:
        with pytest.raises(RpcValidationException):
            service_account_service.create_service_account(
                organization_id=self.organization.id,
                name="seer-agent",
                scope_list=["event:read", "service_account:write"],
                project_ids=[],
                all_projects=False,
                created_by_id=None,
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.filter(organization_id=self.organization.id).exists()

    def test_update_service_account_replaces_scopes_and_projects(self) -> None:
        account_id = self.create()
        other_project = self.create_project()

        with outbox_runner():
            account = service_account_service.update_service_account(
                organization_id=self.organization.id,
                service_account_id=account_id,
                scope_list=["project:read"],
                project_ids=[other_project.id],
                all_projects=False,
            )

        assert account is not None
        assert account.scope_list == ["project:read"]
        assert account.project_ids == self.project_ids(account_id) == [other_project.id]
        with assume_test_silo_mode(SiloMode.CELL):
            replica = ServiceAccountReplica.objects.get(service_account_id=account_id)
            assert replica.scope_list == ["project:read"]
        assert self.replica_project_ids(account_id) == [other_project.id]

    def test_update_to_all_projects_clears_project_links(self) -> None:
        account_id = self.create()

        with outbox_runner():
            account = service_account_service.update_service_account(
                organization_id=self.organization.id,
                service_account_id=account_id,
                scope_list=["event:read"],
                project_ids=[self.project.id],
                all_projects=True,
            )

        assert account is not None
        assert account.all_projects
        assert account.project_ids == self.project_ids(account_id) == []
        with assume_test_silo_mode(SiloMode.CELL):
            assert ServiceAccountReplica.objects.get(service_account_id=account_id).all_projects
        assert self.replica_project_ids(account_id) == []

    def test_update_ungrantable_scope_raises_validation_error(self) -> None:
        account_id = self.create()

        with pytest.raises(RpcValidationException):
            service_account_service.update_service_account(
                organization_id=self.organization.id,
                service_account_id=account_id,
                scope_list=["service_account:write"],
                project_ids=[],
                all_projects=False,
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.get(id=account_id).scope_list == ["event:read"]

    def test_update_service_account_in_another_organization_returns_none(self) -> None:
        account_id = self.create()

        account = service_account_service.update_service_account(
            organization_id=self.create_organization().id,
            service_account_id=account_id,
            scope_list=["project:read"],
            project_ids=[],
            all_projects=True,
        )

        assert account is None
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.get(id=account_id).scope_list == ["event:read"]

    def test_grant_update_outbox_applies_the_latest_grant(self) -> None:
        account_id = self.create()

        with outbox_runner():
            self.queue_grant_update(account_id, ["project:read"])
            self.queue_grant_update(account_id, ["event:read", "project:read"], all_projects=True)

        account = service_account_service.get_service_account(
            organization_id=self.organization.id, service_account_id=account_id
        )
        assert account is not None
        assert account.scope_list == ["event:read", "project:read"]
        assert account.all_projects

        with outbox_runner():
            self.queue_grant_update(account_id, ["service_account:write"])

        account = service_account_service.get_service_account(
            organization_id=self.organization.id, service_account_id=account_id
        )
        assert account is not None
        assert account.scope_list == ["event:read", "project:read"]

    def test_delete_service_account_only_in_its_organization(self) -> None:
        account_id = self.create()

        service_account_service.delete_service_account(
            organization_id=self.create_organization().id, service_account_id=account_id
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.get(id=account_id).is_active

    def test_delete_service_account_soft_deletes(self) -> None:
        account_id = self.create()

        with outbox_runner():
            service_account_service.delete_service_account(
                organization_id=self.organization.id, service_account_id=account_id
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.get(id=account_id).is_active
        assert self.project_ids(account_id) == []
        with assume_test_silo_mode(SiloMode.CELL):
            assert not ServiceAccountReplica.objects.get(service_account_id=account_id).is_active
        assert self.replica_project_ids(account_id) == []

        # A second delete does nothing.
        service_account_service.delete_service_account(
            organization_id=self.organization.id, service_account_id=account_id
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.get(id=account_id).is_active

    def test_deleted_service_account_is_hidden(self) -> None:
        account_id = self.create()
        service_account_service.delete_service_account(
            organization_id=self.organization.id, service_account_id=account_id
        )

        assert (
            service_account_service.get_service_account(
                organization_id=self.organization.id, service_account_id=account_id
            )
            is None
        )
        assert (
            service_account_service.update_service_account(
                organization_id=self.organization.id,
                service_account_id=account_id,
                scope_list=["project:read"],
                project_ids=[self.project.id],
                all_projects=False,
            )
            is None
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.get(id=account_id).scope_list == ["event:read"]
        assert self.project_ids(account_id) == []

    def test_get_service_account(self) -> None:
        account_id = self.create()

        account = service_account_service.get_service_account(
            organization_id=self.organization.id, service_account_id=account_id
        )

        assert account is not None
        assert account.id == account_id
        assert account.scope_list == ["event:read"]
        assert account.project_ids == [self.project.id]
        assert (
            service_account_service.get_service_account(
                organization_id=self.create_organization().id, service_account_id=account_id
            )
            is None
        )
