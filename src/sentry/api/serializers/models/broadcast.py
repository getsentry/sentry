from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Broadcast


@register(Broadcast)
class BroadcastSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'message': obj.message,
            'badge': obj.badge,
            'isActive': obj.is_active,
            'dateCreated': obj.date_added,
        }
