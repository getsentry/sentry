from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.relay import Relay


class OrganizationRelayResponse(TypedDict):
    relayId: str
    version: str
    publicKey: str
    firstSeen: str
    lastSeen: str


@register(Relay)
class RelaySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "relayId": str(obj.relay_id),
            "version": str(obj.version),
            "publicKey": obj.public_key,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
        }
