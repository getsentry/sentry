from sentry.constants import ObjectStatus

from ..base import ModelDeletionTask, ModelRelation


class OrganizationIntegrationDeletionTask(ModelDeletionTask):
    def should_proceed(self, instance):
        return instance.status in {ObjectStatus.DELETION_IN_PROGRESS, ObjectStatus.PENDING_DELETION}

    def get_child_relations(self, instance):
        from sentry.models import Identity

        relations = []

        # delete the identity attached through the default_auth_id
        if instance.default_auth_id:
            relations.append(ModelRelation(Identity, {"id": instance.default_auth_id}))

        return relations

    def delete_instance(self, instance):
        from sentry.models import ProjectCodeOwners, Repository, RepositoryProjectPathConfig

        # Dissociate repos from the integration being deleted. integration
        Repository.objects.filter(
            organization_id=instance.organization_id, integration_id=instance.integration_id
        ).update(integration_id=None)

        # Delete Code Owners with a Code Mapping using the OrganizationIntegration
        ProjectCodeOwners.objects.filter(
            repository_project_path_config__in=RepositoryProjectPathConfig.objects.filter(
                organization_integration_id=instance.id
            ).values_list("id", flat=True)
        ).delete()

        # Delete the Code Mappings
        RepositoryProjectPathConfig.objects.filter(organization_integration_id=instance.id).delete()

        return super().delete_instance(instance)
