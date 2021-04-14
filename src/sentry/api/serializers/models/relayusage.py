from sentry.api.serializers import Serializer, register
from sentry.models import RelayUsage


@register(RelayUsage)
class RelayUsageSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "relayId": obj.relay_id,
            "version": obj.version,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
            "publicKey": obj.public_key,
        }
