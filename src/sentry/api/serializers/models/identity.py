from sentry.api.serializers import Serializer, register, serialize
from sentry.users.models.identity import Identity


@register(Identity)
class IdentitySerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "identityProvider": serialize(obj.idp),
            "externalId": obj.external_id,
            "status": obj.status,
        }
