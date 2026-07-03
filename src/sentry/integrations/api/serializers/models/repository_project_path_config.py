from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register
from sentry.integrations.api.serializers.models.integration import serialize_provider
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration


@register(RepositoryProjectPathConfig)
class RepositoryProjectPathConfigSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        if not item_list:
            return {}

        prefetch_related_objects(
            item_list, "project_repository__project", "project_repository__repository"
        )

        integration_by_oi_id: dict[int, RpcIntegration] = {}

        org_integration_ids = set(
            item.organization_integration_id
            for item in item_list
            if item.organization_integration_id
        )
        if org_integration_ids:
            # We bulk look-up organization-integrations and integrations. We need to map them to
            # one another so there are two intermediate maps before the final item->integration
            # map can be returned.
            org_integrations = integration_service.get_organization_integrations(
                org_integration_ids=list(org_integration_ids)
            )

            integration_ids = set(oi.integration_id for oi in org_integrations)
            integrations = (
                integration_service.get_integrations(integration_ids=list(integration_ids))
                if integration_ids
                else []
            )

            integration_by_id = {integration.id: integration for integration in integrations}
            integration_by_oi_id = {
                oi.id: integration_by_id[oi.integration_id]
                for oi in org_integrations
                if oi.integration_id in integration_by_id
            }

        return {
            item: {"integration": integration_by_oi_id.get(item.organization_integration_id)}
            for item in item_list
        }

    def serialize(self, obj, attrs, user, **kwargs):
        integration = attrs.get("integration")

        provider = integration.get_provider() if integration else None
        serialized_provider = serialize_provider(provider) if provider else None
        integration_id = str(integration.id) if integration else None

        project = obj.project_repository.project
        repository = obj.project_repository.repository

        return {
            "id": str(obj.id),
            "projectId": str(project.id),
            "projectSlug": project.slug,
            "repoId": str(repository.id),
            "repoName": repository.name,
            "integrationId": integration_id,
            "provider": serialized_provider,
            "stackRoot": obj.stack_root,
            "sourceRoot": obj.source_root,
            "defaultBranch": obj.default_branch,
            "automaticallyGenerated": obj.automatically_generated,
        }
