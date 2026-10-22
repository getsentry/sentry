from sentry.hybridcloud.rpc.service import dispatch_to_local_service
from sentry.service_accounts.models import ServiceAccount, ServiceAccountProject
from sentry.service_accounts.services.service_account import RpcServiceAccount
from sentry.service_accounts.services.service_account.service import service_account_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


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
