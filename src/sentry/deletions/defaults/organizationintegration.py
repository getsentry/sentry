from collections.abc import Sequence

from django.db import router, transaction

from sentry.constants import ObjectStatus
from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.repository import repository_service
from sentry.types.cell import CellMappingNotFound

DELETABLE_STATUSES = (ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS)


class OrganizationIntegrationDeletionTask(ModelDeletionTask[OrganizationIntegration]):
    def should_proceed(self, instance: OrganizationIntegration) -> bool:
        return instance.status in DELETABLE_STATUSES

    def delete_bulk(self, instance_list: Sequence[OrganizationIntegration]) -> bool:
        """
        OrganizationIntegration is deleted from two paths:

        1. Scheduled / manual uninstall: rows are PENDING_DELETION and can race
           with re-install. Those need a row lock + claim.
        2. Hybrid-cloud org tombstone cascade: rows are typically still ACTIVE
           after the parent org is gone. That path is high volume and must not
           take the race lock or refuse ACTIVE rows.

        Only the uninstall race path uses select_for_update.
        """
        claimed: list[OrganizationIntegration] = []
        for instance in instance_list:
            if instance.status in DELETABLE_STATUSES:
                if self._claim_for_scheduled_deletion(instance):
                    claimed.append(instance)
            else:
                # Cascade / hard-delete path: parent org is already gone, so the
                # reinstall race does not apply. Keep the ordinary delete query.
                claimed.append(instance)

        if not claimed:
            return False
        return super().delete_bulk(claimed)

    def _claim_for_scheduled_deletion(self, instance: OrganizationIntegration) -> bool:
        with transaction.atomic(using=router.db_for_write(OrganizationIntegration)):
            # Lock only the scheduled-uninstall race with add_organization.
            # OrganizationIntegration is a ReplicatedControlModel, so a bulk
            # CAS update would skip the outbox/replication path. instance_list
            # is currently length 1 for scheduled OI deletes, so locking one
            # row at a time is fine.
            locked = (
                OrganizationIntegration.objects.select_for_update().filter(id=instance.id).first()
            )

            # Concurrent reinstall can flip PENDING_DELETION back to ACTIVE
            # before we claim the row. Bail if that happened.
            if locked is None or locked.status not in DELETABLE_STATUSES:
                return False

            locked.update(status=ObjectStatus.DELETION_IN_PROGRESS)

        # Keep the caller's copy in sync so mark_deletion_in_progress does not
        # issue a redundant write for a row we already claimed.
        instance.status = ObjectStatus.DELETION_IN_PROGRESS
        return True

    def get_child_relations(self, instance: OrganizationIntegration) -> list[BaseRelation]:
        from sentry.users.models.identity import Identity

        relations: list[BaseRelation] = []

        # delete the identity attached through the default_auth_id
        if instance.default_auth_id:
            relations.append(ModelRelation(Identity, {"id": instance.default_auth_id}))

        return relations

    def delete_instance(self, instance: OrganizationIntegration) -> None:
        try:
            repository_service.disassociate_organization_integration(
                organization_id=instance.organization_id,
                organization_integration_id=instance.id,
                integration_id=instance.integration_id,
            )

        except CellMappingNotFound:
            # This can happen when an organization has been deleted already.
            pass
        return super().delete_instance(instance)
