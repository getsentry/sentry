from collections.abc import Sequence

from django.db import router, transaction

from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.service_accounts.models import ServiceAccount, ServiceAccountProject
from sentry.service_accounts.outbox import service_account_grant_update_outbox
from sentry.service_accounts.services.service_account import service_account_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode


class ServiceAccountGrantUpdateOutboxTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        with outbox_runner():
            self.account = Factories.create_service_account(
                self.organization, scope_list=["event:read"], project_ids=[self.project.id]
            )

    def save_update(
        self,
        scope_list: Sequence[str],
        *,
        project_ids: Sequence[int] = (),
        all_projects: bool = False,
    ) -> None:
        with outbox_context(transaction.atomic(router.db_for_write(CellOutbox))):
            service_account_grant_update_outbox(
                organization_id=self.organization.id,
                service_account_id=self.account.id,
                scope_list=scope_list,
                project_ids=project_ids,
                all_projects=all_projects,
            ).save()

    def control_account(self) -> ServiceAccount:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return ServiceAccount.objects.get(id=self.account.id)

    def control_project_ids(self) -> list[int]:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return sorted(
                ServiceAccountProject.objects.filter(
                    service_account_id=self.account.id
                ).values_list("project_id", flat=True)
            )

    def test_outbox_shape(self) -> None:
        outbox = service_account_grant_update_outbox(
            organization_id=self.organization.id,
            service_account_id=self.account.id,
            scope_list=["project:read"],
            project_ids=[self.project.id],
        )

        assert outbox.shard_scope == OutboxScope.SERVICE_ACCOUNT_SCOPE
        assert outbox.shard_identifier == self.organization.id
        assert outbox.category == OutboxCategory.SERVICE_ACCOUNT_GRANT_UPDATE
        assert outbox.object_identifier == self.account.id
        assert outbox.payload == {
            "scope_list": ["project:read"],
            "project_ids": [self.project.id],
            "all_projects": False,
        }

    def test_drain_replaces_the_grant(self) -> None:
        other = self.create_project()

        with outbox_runner():
            self.save_update(scope_list=["project:read"], project_ids=[other.id])

        account = self.control_account()
        assert account.scope_list == ["project:read"]
        assert not account.all_projects
        assert self.control_project_ids() == [other.id]

        with outbox_runner():
            self.save_update(scope_list=["event:read"], all_projects=True)

        account = self.control_account()
        assert account.scope_list == ["event:read"]
        assert account.all_projects
        assert self.control_project_ids() == []

    def test_updates_to_one_account_apply_the_latest_grant(self) -> None:
        with outbox_runner():
            self.save_update(scope_list=["project:read"])
            self.save_update(scope_list=["event:read", "project:read"], all_projects=True)

        account = self.control_account()
        assert account.scope_list == ["event:read", "project:read"]
        assert account.all_projects
        assert not CellOutbox.objects.filter(
            category=OutboxCategory.SERVICE_ACCOUNT_GRANT_UPDATE
        ).exists()

    def test_deleted_account_is_left_as_it_is(self) -> None:
        with outbox_runner():
            service_account_service.delete_service_account(
                organization_id=self.organization.id, service_account_id=self.account.id
            )

        with outbox_runner():
            self.save_update(scope_list=["project:read"], all_projects=True)

        account = self.control_account()
        assert not account.is_active
        assert account.scope_list == ["event:read"]
        assert not account.all_projects

    def test_rejected_grant_is_dropped(self) -> None:
        with outbox_runner():
            self.save_update(scope_list=["service_account:write"])

        assert self.control_account().scope_list == ["event:read"]
        assert self.control_project_ids() == [self.project.id]
        assert not CellOutbox.objects.filter(
            category=OutboxCategory.SERVICE_ACCOUNT_GRANT_UPDATE
        ).exists()
