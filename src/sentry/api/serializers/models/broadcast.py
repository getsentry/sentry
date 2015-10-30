from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Broadcast, BroadcastSeen


@register(Broadcast)
class BroadcastSerializer(Serializer):
    def get_attrs(self, item_list, user):
        if not user.is_authenticated():
            seen = set()
        else:
            seen = set(BroadcastSeen.objects.filter(
                broadcast__in=item_list,
                user=user,
            ).values_list('broadcast', flat=True))

        return {
            item: {
                'seen': item.id in seen,
            } for item in item_list
        }

    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'message': obj.message,
            'title': obj.title,
            'link': obj.link,
            'isActive': obj.is_active,
            'dateCreated': obj.date_added,
            'hasSeen': attrs['seen'],
        }
