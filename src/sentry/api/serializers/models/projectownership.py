from sentry.api.serializers import Serializer, register
from sentry.models import ProjectOwnership


@register(ProjectOwnership)
class ProjectOwnershipSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "raw": obj.raw,
            # Should we expose this?
            # 'schema': obj.schema,
            "fallthrough": obj.fallthrough,
            "dateCreated": obj.date_created,
            "lastUpdated": obj.last_updated,
            "isActive": obj.is_active,
            "autoAssignment": obj.auto_assignment,
        }
