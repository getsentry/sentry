from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import RelayUsage


@register(RelayUsage)
class RelayUsageSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "relayId": self.relay_id,
            "version": self.version,
            "firstSeen": self.first_seen,
            "lastSeen": self.last_seen,
            "publicKey": "xxxx",  # TODO return real public key once it is added to the model
        }
