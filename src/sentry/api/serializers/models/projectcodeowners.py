from sentry.api.serializers import Serializer, register
from sentry.models import ProjectCodeOwners


@register(ProjectCodeOwners)
class ProjectCodeOwnersSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        data = {
            "raw": obj.raw,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "codeMappingId": str(obj.repository_project_path_config_id),
            "provider": "unknown",
        }
        if obj.repository_project_path_config.organization_integration:
            data[
                "provider"
            ] = obj.repository_project_path_config.organization_integration.integration.provider

        return data
