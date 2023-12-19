from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.relay import Relay


class OrganizationRelayResponse(TypedDict):
    id: str
    relayId: str
    publicKey: str
    firstSeen: str
    lastSeen: str


@register(Relay)
class RelaySerializer(Serializer):
    def serialize(self, obj, attrs, user) -> OrganizationRelayResponse:
        return {
            "id": str(obj.id),
            "relayId": str(obj.relay_id),
            "publicKey": obj.public_key,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
        }
