from collections.abc import Sequence

from django.db import router

from sentry import features
from sentry.constants import ObjectStatus
from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.repository import repository_service
from sentry.organizations.services.organization import organization_service
from sentry.silo.safety import unguarded_write
from sentry.types.cell import CellMappingNotFound

DELETABLE_STATUSES = (ObjectStatus.PENDING_DELETION, ObjectStatus.DELETION_IN_PROGRESS)


def use_cas_deletion_claim(organization_id: int) -> bool:
    context = organization_service.get_organization_by_id(
        id=organization_id, include_projects=False, include_teams=False
    )
    return (
        features.has("organizations:integrations-deletion-reinstall-cas", context.organization)
        if context is not None
        else False
    )


class OrganizationIntegrationDeletionTask(ModelDeletionTask[OrganizationIntegration]):
    def should_proceed(self, instance: OrganizationIntegration) -> bool:
        return instance.status in DELETABLE_STATUSES

    def delete_bulk(self, instance_list: Sequence[OrganizationIntegration]) -> bool:
        claimed = [instance for instance in instance_list if self._claim(instance)]
        if not claimed:
            return False
        return super().delete_bulk(claimed)

    def _claim(self, instance: OrganizationIntegration) -> bool:
        if not use_cas_deletion_claim(instance.organization_id):
            return True  # Legacy delete behavior.

        # Compare-and-swap claim. A single UPDATE ... WHERE status IN (...) is
        # atomic, so we never hold a row lock while doing other work (a prior
        # SELECT FOR UPDATE version of this stalled the database under lock
        # contention). If a concurrent re-installation flipped the row back to
        # ACTIVE, the WHERE clause fails to match and we do not delete.
        #
        # Caveat: OrganizationIntegration is a ReplicatedControlModel and a bulk
        # UPDATE skips the outbox replication scheme. Replication is currently
        # disabled for the status column so this is a no-op today (hence
        # `unguarded_write`), but if status replication is ever enabled this CAS
        # must be revisited or cell data will silently drift from the control
        # silo's state.
        with unguarded_write(using=router.db_for_write(OrganizationIntegration)):
            claimed = OrganizationIntegration.objects.filter(
                id=instance.id, status__in=DELETABLE_STATUSES
            ).update(status=ObjectStatus.DELETION_IN_PROGRESS)
        if not claimed:
            # The only way the row's status is not one of the DELETABLE_STATUSES
            # is if a concurrent writer flipped it to ACTIVE (re-installation) or
            # the row is already gone. Either way, don't proceed.
            return False

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
