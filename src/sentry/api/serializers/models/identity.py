from sentry.api.serializers import Serializer, register
from sentry.models import Identity, IdentityProvider
from sentry.api.serializers import serialize

@register(Identity)
class IdentitySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "identityProvider": serialize(obj.idp),
            "externalId": obj.external_id,
            "status": obj.status,
        }
