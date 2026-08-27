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
            # This is a particularly nasty query I did not want to write. We have to
            # redundantly fetch the instances in a loop so we can lock the row. I might
            # have done something more efficient like a bulk CAS update, however, it
            # runs afoul of hybrid-cloud. Specifically, OrganizationIntegration is a
            # "ReplicatedControlModel". The bulk CAS (UPDATE ... WHERE ...) skips the
            # replication scheme. However, there is a catch. Replication is disabled
            # for the status column of this model (for now) so technically the outbox
            # pattern is a no-op when updating the status. But if that ever changes
            # then the proposed CAS operation would silently break and you'd have
            # stale cell data conflicting with the control silo's state.
            #
            # We can make this more efficient by querying the OrganizationIntegration
            # rows in bulk. However, because we're locking the rows this could deadlock
            # if concurrent delete tasks are running (or any task which locks multiple
            # overlapping rows). You could fix this locally by ordering by id. However,
            # this does not fix the issue globally. Anyone else locking multiple
            # overlapping rows concurrently would deadlock unless they also order by id.
            # Now or in the future.
            #
            # There's one final complication that makes everything I said pointless! The
            # instance_list for OrganizationIntegration deletions is only ever length 1.
            # So the "inefficiency" of querying in a loop is not actually relevant. Again,
            # we're guarding against changes. Whoever constructed the delete system
            # intended multi-row deletions to be possible. Follow-up work could make that
            # a reality. We don't want it to silently fail. I'd rather it be expensive and
            # correct.
            #
            # All of that just to say we're being very cautious here. It's not clear to me
            # why we delete at all and not just set the state to HIDDEN or DISABLED or
            # better adopt an immutable data model so we're not concurrently updating
            # shared state.
            locked = (
                OrganizationIntegration.objects.select_for_update().filter(id=instance.id).first()
            )

            # The only way this row's state is not one of the "DELETABLE_STATUSES"
            # is if a concurrent writer flipped it to ACTIVE (re-installation). If
            # that happens we don't want to proceed with the deletion because the
            # row is now in use.
            if locked is None or locked.status not in DELETABLE_STATUSES:
                return False

            # We own the row and can set the status. Future writers should respect
            # this state transition but it is not enforceable from here. If someone
            # were to update the status to ACTIVE the deletion process will not halt.
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
