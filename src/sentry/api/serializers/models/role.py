from sentry.api.serializers import Serializer


class RoleSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        allowed_roles = kwargs.get("allowed_roles") or []

        return {
            "id": str(obj.id),
            "name": obj.name,
            "desc": obj.desc,
            "scopes": obj.scopes,
            "is_global": obj.is_global,
            "allowed": obj in allowed_roles,
        }
