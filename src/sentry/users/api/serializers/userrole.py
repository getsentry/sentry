from sentry.api.serializers import Serializer, register
from sentry.users.models.userrole import UserRole


@register(UserRole)
class UserRoleSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "name": obj.name,
            "permissions": obj.permissions,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
