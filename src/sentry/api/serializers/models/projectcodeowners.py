from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.repository_project_path_config import (
    RepositoryProjectPathConfigSerializer,
)
from sentry.models import ProjectCodeOwners
from sentry.ownership.grammar import convert_schema_to_rules_text


@register(ProjectCodeOwners)
class ProjectCodeOwnersSerializer(Serializer):
    def __init__(
        self,
        expand=None,
    ):
        self.expand = expand or []

    def get_attrs(self, item_list, user, **kwargs):
        prefetch_related_objects(
            item_list,
            "repository_project_path_config__organization_integration",
        )

        return {
            item: {
                "provider": item.repository_project_path_config.organization_integration.integration.provider
                if item.repository_project_path_config.organization_integration
                else "unknown",
                "codeMapping": item.repository_project_path_config,
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        data = {
            "id": str(obj.id),
            "raw": obj.raw,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "codeMappingId": str(obj.repository_project_path_config_id),
            "provider": "unknown",
        }

        data["provider"] = attrs.get("provider", "unknown")

        if "codeMapping" in self.expand:
            config = attrs.get("codeMapping", {})
            data["codeMapping"] = serialize(
                config, user=user, serializer=RepositoryProjectPathConfigSerializer()
            )
        if "ownershipSyntax" in self.expand:
            data["ownershipSyntax"] = convert_schema_to_rules_text(obj.schema)

        if "errors" in self.expand:
            _, errors = ProjectCodeOwners.validate_codeowners_associations(obj.raw, obj.project)
            data["errors"] = errors

        return data
