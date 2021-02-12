from sentry.api.serializers import Serializer, register
from sentry.models import ProjectCodeOwners


@register(ProjectCodeOwners)
class ProjectCodeOwnersSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        data = {
            "raw": obj.raw,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "provider": "unknown",
        }
        if obj.organization_integration:
            data["provider"] = obj.organization_integration.integration.provider

        return data
