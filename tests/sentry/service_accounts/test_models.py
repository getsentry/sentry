from contextlib import AbstractContextManager
from datetime import timedelta
from unittest import mock

import pytest
from django.core.exceptions import ValidationError
from django.db import router, transaction
from django.utils import timezone

from sentry import deletions
from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.hybridcloud.models.outbox import CellOutbox, ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.project import Project
from sentry.service_accounts.models import (
    ServiceAccount,
    ServiceAccountProject,
    ServiceAccountProjectReplica,
    ServiceAccountReplica,
    validate_grantable_scopes,
)
from sentry.service_accounts.services.service_account import service_account_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, control_silo_test


def test_validate_grantable_scopes_accepts_api_scopes() -> None:
    validate_grantable_scopes(["org:read", "project:write", "event:admin"])


@pytest.mark.parametrize("scope", ["openid", "profile", "email", "not:a-scope"])
def test_validate_grantable_scopes_rejects_non_grantable(scope: str) -> None:
    with pytest.raises(ValidationError):
        validate_grantable_scopes(["org:read", scope])


@control_silo_test
class ServiceAccountOutboxTest(TestCase):
    """
    Cells read service accounts from a replica that this outbox writes, so every create,
    update and delete has to write one for the org's cell.
    """

    def unflushed_outboxes(self) -> AbstractContextManager[object]:
        return outbox_context(transaction.atomic(router.db_for_write(ServiceAccount)), flush=False)

    def assert_outbox_written(
        self, service_account_id: int, organization_id: int, count: int = 1
    ) -> None:
        outboxes = list(
            ControlOutbox.objects.filter(
                category=OutboxCategory.SERVICE_ACCOUNT_UPDATE,
                object_identifier=service_account_id,
            )
        )
        assert len(outboxes) == count
        cell_name = OrganizationMapping.objects.get(organization_id=organization_id).cell_name
        for outbox in outboxes:
            assert outbox.shard_scope == OutboxScope.ORGANIZATION_SCOPE
            assert outbox.shard_identifier == organization_id
            assert outbox.cell_name == cell_name
        ControlOutbox.objects.filter(id__in=[o.id for o in outboxes]).delete()

    def test_writes_outbox_for_org_cell_on_every_change(self) -> None:
        organization = self.create_organization()

        with self.unflushed_outboxes():
            service_account = ServiceAccount.objects.create(
                organization_id=organization.id, name="seer-autofix", scope_list=["org:read"]
            )
        self.assert_outbox_written(service_account.id, organization.id)

        with self.unflushed_outboxes():
            service_account.update(is_active=False)
        self.assert_outbox_written(service_account.id, organization.id)

        service_account_id = service_account.id
        with self.unflushed_outboxes():
            service_account.delete()
        self.assert_outbox_written(service_account_id, organization.id)

    def test_project_link_changes_write_account_outbox(self) -> None:
        organization = self.create_organization()
        service_account = ServiceAccount.objects.create(
            organization_id=organization.id, name="seer-autofix"
        )
        ControlOutbox.objects.all().delete()

        with self.unflushed_outboxes():
            link = ServiceAccountProject.objects.create(
                service_account=service_account, project_id=1
            )
        self.assert_outbox_written(service_account.id, organization.id)

        with self.unflushed_outboxes():
            link.delete()
        self.assert_outbox_written(service_account.id, organization.id)

        with self.unflushed_outboxes():
            ServiceAccountProject.objects.bulk_create(
                [
                    ServiceAccountProject(service_account=service_account, project_id=2),
                    ServiceAccountProject(service_account=service_account, project_id=3),
                ]
            )
        self.assert_outbox_written(service_account.id, organization.id, count=2)

    def test_project_deletion_cascade_writes_account_outbox(self) -> None:
        organization = self.create_organization()
        service_account = ServiceAccount.objects.create(
            organization_id=organization.id, name="seer-autofix"
        )
        link = ServiceAccountProject.objects.create(service_account=service_account, project_id=1)
        ControlOutbox.objects.all().delete()

        # The hybrid cloud foreign key cascade deletes links for a deleted project this way.
        with self.unflushed_outboxes():
            task = deletions.get(
                model=ServiceAccountProject, query={"id__in": [link.id]}, transaction_id="test"
            )
            while task.chunk():
                pass

        assert not ServiceAccountProject.objects.filter(id=link.id).exists()
        self.assert_outbox_written(service_account.id, organization.id)


@all_silo_test
class ServiceAccountReplicationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.projects = [self.create_project(organization=self.organization) for _ in range(2)]
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account = ServiceAccount.objects.create(
                organization_id=self.organization.id,
                name="seer-autofix",
                scope_list=["org:read", "project:read"],
            )
            for project in self.projects:
                ServiceAccountProject.objects.create(
                    service_account=self.service_account, project_id=project.id
                )
        # Deleting the account clears its `id`, so keep a copy for reads after the delete.
        self.service_account_id = self.service_account.id

    def get_replica(self) -> ServiceAccountReplica | None:
        with assume_test_silo_mode(SiloMode.CELL):
            return ServiceAccountReplica.objects.filter(
                service_account_id=self.service_account_id
            ).first()

    def get_replica_project_ids(self) -> set[int]:
        with assume_test_silo_mode(SiloMode.CELL):
            return set(
                ServiceAccountProjectReplica.objects.filter(
                    service_account__service_account_id=self.service_account_id
                ).values_list("project_id", flat=True)
            )

    def test_create_replicates_account_and_projects(self) -> None:
        replica = self.get_replica()
        assert replica is not None
        assert replica.organization_id == self.organization.id
        assert replica.name == "seer-autofix"
        assert replica.scope_list == ["org:read", "project:read"]
        assert replica.is_active
        assert not replica.all_projects
        assert self.get_replica_project_ids() == {project.id for project in self.projects}

    def test_update_replicates(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(is_active=False, scope_list=["org:read"], all_projects=True)

        replica = self.get_replica()
        assert replica is not None
        assert not replica.is_active
        assert replica.scope_list == ["org:read"]
        assert replica.all_projects

    def test_project_link_changes_replicate(self) -> None:
        new_project = self.create_project(organization=self.organization)
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            ServiceAccountProject.objects.get(
                service_account=self.service_account, project_id=self.projects[0].id
            ).delete()
            ServiceAccountProject.objects.create(
                service_account=self.service_account, project_id=new_project.id
            )

        assert self.get_replica_project_ids() == {self.projects[1].id, new_project.id}

    def test_skips_links_to_projects_outside_the_org(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            ServiceAccountProject.objects.create(
                service_account=self.service_account, project_id=other_project.id
            )

        assert self.get_replica_project_ids() == {project.id for project in self.projects}

    def get_control_project_ids(self) -> set[int]:
        with assume_test_silo_mode(SiloMode.CONTROL):
            return set(
                ServiceAccountProject.objects.filter(
                    service_account_id=self.service_account_id
                ).values_list("project_id", flat=True)
            )

    def test_project_transfer_removes_link(self) -> None:
        other_org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CELL):
            self.projects[0].transfer_to(organization=other_org)

        # The replica link goes with the transfer, before any outbox runs.
        assert self.get_replica_project_ids() == {self.projects[1].id}

        with outbox_runner():
            pass

        assert self.get_control_project_ids() == {self.projects[1].id}
        assert self.get_replica_project_ids() == {self.projects[1].id}

    def test_project_transferred_back_does_not_regain_link(self) -> None:
        other_org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CELL), outbox_runner():
            self.projects[0].transfer_to(organization=other_org)
        with assume_test_silo_mode(SiloMode.CELL), outbox_runner():
            self.projects[0].transfer_to(organization=self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(name="seer-autofix-2")

        assert self.get_control_project_ids() == {self.projects[1].id}
        assert self.get_replica_project_ids() == {self.projects[1].id}

    def test_project_transferred_back_before_cleanup_does_not_regain_link(self) -> None:
        other_org = self.create_organization()
        now = timezone.now()
        with assume_test_silo_mode(SiloMode.CELL), freeze_time(now + timedelta(minutes=1)):
            self.projects[0].transfer_to(organization=other_org)
        with assume_test_silo_mode(SiloMode.CELL), freeze_time(now + timedelta(minutes=2)):
            self.projects[0].transfer_to(organization=self.organization)
        # Linked after the project came back, so the delayed cleanup must keep it.
        with assume_test_silo_mode(SiloMode.CONTROL), freeze_time(now + timedelta(minutes=3)):
            relinked_account = ServiceAccount.objects.create(
                organization_id=self.organization.id, name="relinked"
            )
            ServiceAccountProject.objects.create(
                service_account=relinked_account, project_id=self.projects[0].id
            )

        with outbox_runner():
            pass
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(name="seer-autofix-2")

        assert self.get_control_project_ids() == {self.projects[1].id}
        assert self.get_replica_project_ids() == {self.projects[1].id}
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccountProject.objects.filter(
                service_account=relinked_account, project_id=self.projects[0].id
            ).exists()

    def test_project_transfer_completes_when_link_cleanup_fails(self) -> None:
        other_org = self.create_organization()
        with (
            assume_test_silo_mode(SiloMode.CELL),
            mock.patch.object(
                service_account_service,
                "remove_project_links_after_transfer",
                side_effect=Exception("control unavailable"),
            ),
            self.captureOnCommitCallbacks(execute=True),
        ):
            self.projects[0].transfer_to(organization=other_org)

            # The outbox waits for the async drain instead of flushing on commit.
            assert CellOutbox.objects.filter(
                category=OutboxCategory.PROJECT_UPDATE,
                shard_identifier=self.organization.id,
                object_identifier=self.projects[0].id,
            ).exists()
            assert Project.objects.get(id=self.projects[0].id).organization_id == other_org.id

    def test_project_transfer_keeps_links_from_the_new_org(self) -> None:
        other_org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            other_account = ServiceAccount.objects.create(
                organization_id=other_org.id, name="other-account"
            )
            # A stale link, like one left behind by an earlier transfer out of `other_org`.
            ServiceAccountProject.objects.create(
                service_account=other_account, project_id=self.projects[0].id
            )

        with assume_test_silo_mode(SiloMode.CELL), outbox_runner():
            self.projects[0].transfer_to(organization=other_org)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert ServiceAccountProject.objects.filter(
                service_account=other_account, project_id=self.projects[0].id
            ).exists()

    def test_update_drops_existing_link_to_project_outside_the_org(self) -> None:
        other_org = self.create_organization()
        # Moves the project without the transfer cleanup, to test replication on its own.
        with assume_test_silo_mode(SiloMode.CELL):
            Project.objects.filter(id=self.projects[0].id).update(organization_id=other_org.id)
        assert self.get_replica_project_ids() == {project.id for project in self.projects}

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(name="seer-autofix-2")

        assert self.get_replica_project_ids() == {self.projects[1].id}

    def test_replication_is_idempotent(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.update(name="seer-autofix")

        with assume_test_silo_mode(SiloMode.CELL):
            assert ServiceAccountReplica.objects.count() == 1
            assert ServiceAccountProjectReplica.objects.count() == len(self.projects)

    def test_delete_removes_replica(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            self.service_account.delete()

        with self.tasks(), assume_test_silo_mode(SiloMode.CELL):
            schedule_hybrid_cloud_foreign_key_jobs()

        assert self.get_replica() is None
        assert self.get_replica_project_ids() == set()
