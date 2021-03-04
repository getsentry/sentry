from sentry.api.serializers import Serializer, register
from sentry.api.serializers.models.integration import serialize_provider
from sentry.models import RepositoryProjectPathConfig


@register(RepositoryProjectPathConfig)
class RepositoryProjectPathConfigSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        integration = (
            obj.organization_integration.integration if obj.organization_integration else None
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
        }
