from ..base import ModelDeletionTask, ModelRelation


class OrganizationIntegrationDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import ExternalIssue

        return [
            ModelRelation(
                ExternalIssue,
                {
                    "integration_id": instance.integration_id,
                    "organization_id": instance.organization_id,
                },
            )
        ]
