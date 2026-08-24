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
        claimed = [instance for instance in instance_list if self._claim(instance)]
        if not claimed:
            return False
        return super().delete_bulk(claimed)

    def _claim(self, instance: OrganizationIntegration) -> bool:
        with transaction.atomic(using=router.db_for_write(OrganizationIntegration)):
            locked = (
                OrganizationIntegration.objects.select_for_update().filter(id=instance.id).first()
            )

            # The only way this row's state is not one of the "DELETABLE_STATUSES"
            # is if a concurrent writer flipped it to active (re-installation). If
            # that happens we don't want to proceed with the deletion because the
            # row is now in use.
            if locked is None or locked.status not in DELETABLE_STATUSES:
                return False

            # We own the row and can set the status. Future writers should respect
            # this state transition but it is not enforceable from here.
            locked.update(status=ObjectStatus.DELETION_IN_PROGRESS)

        # Keep the caller's copy in sync so `mark_deletion_in_progress` does not
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
