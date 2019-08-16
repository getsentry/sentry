from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Relay


@register(Relay)
class RelaySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "relayId": six.text_type(obj.relay_id),
            "publicKey": obj.public_key,
            "firstSeen": obj.first_seen,
            "lastSeen": obj.last_seen,
        }
