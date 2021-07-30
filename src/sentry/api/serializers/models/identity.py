from django.conf import settings

from sentry.api.serializers import Serializer, register
from sentry.models import Identity


@register(Identity)
class IdentitySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "externalId": obj.external_id,
            "status": obj.status,
            "provider": obj.idp.type,

            # "providerLabel": settings.AUTH_PROVIDER_LABELS[obj.provider],
        }
