from sentry.api.serializers import Serializer, register
from sentry.models import Relay


@register(Relay)
class RelaySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": f"{obj.id}",
            "relayId": f"{obj.relay_id}",
            "publicKey": obj.public_key,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
        }
