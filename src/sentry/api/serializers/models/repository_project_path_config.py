from sentry.api.serializers import Serializer, register
from sentry.api.serializers.models.integration import serialize_provider
from sentry.models import RepositoryProjectPathConfig
from sentry.services.hybrid_cloud.integration import integration_service


@register(RepositoryProjectPathConfig)
class RepositoryProjectPathConfigSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        integration = None
        if obj.organization_integration_id:
            integration = integration_service.get_integration(
                organization_integration_id=obj.organization_integration_id
            )

        provider = integration.get_provider() if integration else None
        serialized_provider = serialize_provider(provider) if provider else None
        integration_id = str(integration.id) if integration else None

        return {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "projectSlug": obj.project.slug,
            "repoId": str(obj.repository.id),
            "repoName": obj.repository.name,
            "integrationId": integration_id,
            "provider": serialized_provider,
            "stackRoot": obj.stack_root,
            "sourceRoot": obj.source_root,
            "defaultBranch": obj.default_branch,
            "automaticallyGenerated": obj.automatically_generated,
        }
