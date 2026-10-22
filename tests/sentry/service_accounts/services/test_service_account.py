from django.core.cache import cache
from django.db import router

from sentry.hybridcloud.rpc.service import dispatch_to_local_service
from sentry.service_accounts.models import ServiceAccount, ServiceAccountProject
from sentry.service_accounts.services.service_account import RpcServiceAccount
from sentry.service_accounts.services.service_account.service import service_account_service
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, cell_silo_test


@all_silo_test
class ServiceAccountServiceTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.projects = [self.create_project(organization=self.organization) for _ in range(2)]
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.service_account = ServiceAccount.objects.create(
                organization_id=self.organization.id,
                name="seer-autofix",
                scope_list=["org:read", "project:read"],
            )
            for project in reversed(self.projects):
                ServiceAccountProject.objects.create(
                    service_account=self.service_account, project_id=project.id
                )

    def test_get_service_account(self) -> None:
        result = service_account_service.get_service_account(
            service_account_id=self.service_account.id
        )

        assert result == RpcServiceAccount(
            id=self.service_account.id,
            organization_id=self.organization.id,
            name="seer-autofix",
            scope_list=["org:read", "project:read"],
            is_active=True,
            project_ids=sorted(project.id for project in self.projects),
        )

    def test_get_service_account_without_projects(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            ServiceAccountProject.objects.filter(service_account=self.service_account).delete()

        result = service_account_service.get_service_account(
            service_account_id=self.service_account.id
        )

        assert result is not None
        assert result.project_ids == []

    def test_get_missing_service_account(self) -> None:
        assert service_account_service.get_service_account(service_account_id=0) is None

    def test_serialization_round_trip(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            result = dispatch_to_local_service(
                "service_account",
                "get_service_account",
                {"service_account_id": self.service_account.id},
            )

        assert result["value"]["id"] == self.service_account.id
        assert result["value"]["project_ids"] == sorted(project.id for project in self.projects)


@cell_silo_test
class CachedServiceAccountTest(TestCase):
    """
    The cell reads service accounts through a cache, and the account's outbox is the only
    thing that clears it, so each kind of change has to reach the next cell read.
    """

    def setUp(self) -> None:
        super().setUp()
        cache.clear()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account = ServiceAccount.objects.create(
                organization_id=self.organization.id,
                name="seer-autofix",
                scope_list=["org:read", "project:read"],
            )
        # Deleting the account clears its `id`, so keep a copy for reads after the delete.
        self.service_account_id = self.service_account.id

    def get_cached(self) -> RpcServiceAccount | None:
        return service_account_service.get(service_account_id=self.service_account_id)

    def test_reads_from_cache(self) -> None:
        cached = self.get_cached()
        assert cached is not None

        # A queryset update writes no outbox, so the cell keeps serving the cached copy.
        with (
            assume_test_silo_mode(SiloMode.CONTROL),
            unguarded_write(using=router.db_for_write(ServiceAccount)),
        ):
            ServiceAccount.objects.filter(id=self.service_account.id).update(is_active=False)

        assert self.get_cached() == cached

    def test_update_clears_cache(self) -> None:
        cached = self.get_cached()
        assert cached is not None
        assert cached.is_active

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(is_active=False, scope_list=["org:read"])

        cached = self.get_cached()
        assert cached is not None
        assert not cached.is_active
        assert cached.scope_list == ["org:read"]

    def test_project_change_clears_cache(self) -> None:
        cached = self.get_cached()
        assert cached is not None
        assert cached.project_ids == []

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            link = ServiceAccountProject.objects.create(
                service_account=self.service_account, project_id=self.project.id
            )

        cached = self.get_cached()
        assert cached is not None
        assert cached.project_ids == [self.project.id]

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            link.delete()

        cached = self.get_cached()
        assert cached is not None
        assert cached.project_ids == []

    def test_delete_clears_cache(self) -> None:
        assert self.get_cached() is not None

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.delete()

        assert self.get_cached() is None
