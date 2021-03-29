from sentry.api.serializers import Serializer, register
from sentry.models import ProjectCodeOwners
from sentry.utils.db import attach_foreignkey


@register(ProjectCodeOwners)
class ProjectCodeOwnersSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attach_foreignkey(
            item_list,
            ProjectCodeOwners.repository_project_path_config,
            related=("organization_integration",),
        )

        return {
            item: {
                "provider": item.repository_project_path_config.organization_integration.integration.provider
                if item.repository_project_path_config.organization_integration
                else "unknown"
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

        return data
