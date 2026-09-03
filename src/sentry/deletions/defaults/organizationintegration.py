from collections.abc import Mapping, Sequence
from typing import Any

from django.db import router, transaction

from sentry.constants import ObjectStatus
from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.deletions.manager import DeletionTaskManager
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.repository import repository_service
from sentry.types.cell import CellMappingNotFound

DELETABLE_STATUSES = (ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS)


class OrganizationIntegrationDeletionTask(ModelDeletionTask[OrganizationIntegration]):
    def __init__(
        self,
        manager: DeletionTaskManager,
        model: type[OrganizationIntegration],
        query: Mapping[str, Any],
        *,
        claim_pending_deletion: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(manager, model, query, **kwargs)
        # Scheduled uninstall races with reinstall and must claim under lock.
        # Hybrid-cloud org tombstone cascade deletes ACTIVE rows at high volume
        # and must not take that lock.
        self.claim_pending_deletion = claim_pending_deletion

    def should_proceed(self, instance: OrganizationIntegration) -> bool:
        return instance.status in DELETABLE_STATUSES

    def delete_bulk(self, instance_list: Sequence[OrganizationIntegration]) -> bool:
        if self.claim_pending_deletion:
            claimed = [
                instance
                for instance in instance_list
                if self._claim_for_scheduled_deletion(instance)
            ]
        else:
            # Cascade / hard-delete: no uninstall↔reinstall race to guard.
            claimed = list(instance_list)

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
