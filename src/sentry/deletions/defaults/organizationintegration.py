from sentry.constants import ObjectStatus
from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.repository import repository_service
from sentry.types.region import RegionMappingNotFound


class OrganizationIntegrationDeletionTask(ModelDeletionTask[OrganizationIntegration]):
    def should_proceed(self, instance: OrganizationIntegration) -> bool:
        return instance.status in {ObjectStatus.DELETION_IN_PROGRESS, ObjectStatus.PENDING_DELETION}

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
        except RegionMappingNotFound:
            # This can happen when an organization has been deleted already.
            pass
        return super().delete_instance(instance)
