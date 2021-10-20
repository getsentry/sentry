from sentry.api.serializers import Serializer, register
from sentry.models import IdentityProvider


@register(IdentityProvider)
class IdentityProviderSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "type": obj.type,
            "externalId": obj.external_id,
        }
