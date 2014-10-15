from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Event


@register(Event)
class EventSerializer(Serializer):
    def serialize(self, obj, user):
        d = {
            'id': str(obj.id),
            'eventID': str(obj.event_id),
            'project': {
                'id': str(obj.project.id),
                'name': obj.project.name,
                'slug': obj.project.slug,
            },
            'message': obj.message,
            'checksum': obj.checksum,
            'platform': obj.platform,
            'dateCreated': obj.datetime,
            'timeSpent': obj.time_spent,
        }
        return d
