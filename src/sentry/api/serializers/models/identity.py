from sentry.api.serializers import Serializer, register
from sentry.models import Identity


@register(Identity)
class IdentitySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "providerName": obj.idp.type,
            "externalId": obj.external_id,
            "status": obj.status,
        }
