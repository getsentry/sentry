import pytest

from sentry.hybridcloud.rpc.service import RpcValidationException
from sentry.service_accounts.models import (
    ServiceAccount,
    ServiceAccountProject,
    ServiceAccountReplica,
)
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

    def test_delete_service_account_only_in_its_organization(self) -> None:
        account_id = self.create()

        service_account_service.delete_service_account(
            organization_id=self.create_organization().id, service_account_id=account_id
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccount.objects.filter(id=account_id).exists()

        with outbox_runner():
            service_account_service.delete_service_account(
                organization_id=self.organization.id, service_account_id=account_id
            )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert not ServiceAccount.objects.filter(id=account_id).exists()

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
