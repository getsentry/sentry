from django.db.models import prefetch_related_objects

from sentry import features
from sentry.api.serializers import Serializer, register
from sentry.integrations.api.serializers.models.integration import serialize_provider
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.services.integration import integration_service


@register(RepositoryProjectPathConfig)
class RepositoryProjectPathConfigSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        if not item_list:
            return {}

        organization = item_list[0].project.organization
        use_fk = features.has("organizations:project-repository-fk-reads", organization)
        if use_fk:
            prefetch_related_objects(
                item_list, "project_repository__project", "project_repository__repository"
            )
        else:
            prefetch_related_objects(item_list, "project", "repository")

        return {item: {"use_project_repository_fk": use_fk} for item in item_list}

    def serialize(self, obj, attrs, user, **kwargs):
        integration = None
        if obj.organization_integration_id:
            integration = integration_service.get_integration(
                organization_integration_id=obj.organization_integration_id
            )

        provider = integration.get_provider() if integration else None
        serialized_provider = serialize_provider(provider) if provider else None
        integration_id = str(integration.id) if integration else None

        if attrs.get("use_project_repository_fk"):
            project = obj.project_repository.project
            repository = obj.project_repository.repository
        else:
            project = obj.project
            repository = obj.repository

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
