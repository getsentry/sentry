from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.relay import RelayUsage


class OrganizationRelayResponse(TypedDict):
    relayId: str
    version: str
    publicKey: str | None
    firstSeen: datetime
    lastSeen: datetime


@register(RelayUsage)
class RelayUsageSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> OrganizationRelayResponse:
        return {
            "relayId": obj.relay_id,
            "version": obj.version,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
            "publicKey": obj.public_key,
        }
