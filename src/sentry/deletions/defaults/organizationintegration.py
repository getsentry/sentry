from sentry.constants import ObjectStatus

from ..base import ModelDeletionTask, ModelRelation


class OrganizationIntegrationDeletionTask(ModelDeletionTask):
    def should_proceed(self, instance):
        return instance.status in {ObjectStatus.DELETION_IN_PROGRESS, ObjectStatus.PENDING_DELETION}

    def get_child_relations(self, instance):
        from sentry.models import (
            ExternalIssue,
            Identity,
            IntegrationExternalProject,
            PagerDutyService,
        )

        relations = [
            ModelRelation(
                ExternalIssue,
                {
                    "integration_id": instance.integration_id,
                    "organization_id": instance.organization_id,
                },
            ),
            ModelRelation(IntegrationExternalProject, {"organization_integration_id": instance.id}),
            ModelRelation(PagerDutyService, {"organization_integration_id": instance.id}),
        ]

        # delete the identity attached through the default_auth_id
        if instance.default_auth_id:
            relations.append(ModelRelation(Identity, {"id": instance.default_auth_id}))

        return relations

    def delete_instance(self, instance):
        from sentry.models import Repository, RepositoryProjectPathConfig

        # Dissociate repos from the integration being deleted. integration
        Repository.objects.filter(
            organization_id=instance.organization_id, integration_id=instance.integration_id
        ).update(integration_id=None)

        # Detach path mappings from the integration as well.
        RepositoryProjectPathConfig.objects.filter(organization_integration_id=instance.id).update(
            organization_integration_id=None
        )

        return super().delete_instance(instance)
