from sentry.api.serializers import Serializer, register
from sentry.models import ProjectCodeOwners
from sentry.models.integration import Integration


@register(ProjectCodeOwners)
class ProjectCodeOwnersSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        attrs = {}
        for item in item_list:
            org_integration = item.repository_project_path_config.organization_integration
            if org_integration:
                try:
                    integration = Integration.objects.get(id=org_integration.integration_id)
                    attrs[item] = {"provider": integration.provider}
                except Integration.DoesNotExist:
                    attrs[item] = {"provider": "unknown"}
            else:
                attrs[item] = {"provider": "unknown"}
        return attrs

    def serialize(self, obj, attrs, user):
        data = {
            "raw": obj.raw,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "codeMappingId": str(obj.repository_project_path_config_id),
            "provider": "unknown",
        }

        data["provider"] = attrs.get("provider", "unknown")

        return data
