from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import UserReport


@register(UserReport)
class UserReportSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        # TODO(dcramer): add in various context from the event
        # context == user / http / extra interfaces
        return {
            'id': str(obj.id),
            'eventID': obj.event_id,
            'name': obj.name,
            'email': obj.email,
            'comments': obj.comments,
            'dateCreated': obj.date_added,
        }
