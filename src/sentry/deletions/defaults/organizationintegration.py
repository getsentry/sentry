from __future__ import absolute_import, print_function

from ..base import ModelDeletionTask, ModelRelation


class OrganizationIntegrationDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import ExternalIssue, ProjectIntegration

        return [
            ModelRelation(ProjectIntegration, {
                'integration_id': instance.integration_id,
                'project__organization': instance.organization_id,
            }),
            ModelRelation(ExternalIssue, {
                'integration_id': instance.integration_id,
                'organization_id': instance.organization_id,
            }),
        ]
