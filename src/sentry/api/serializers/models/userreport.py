from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import UserReport, UserReportResolution


@register(UserReport)
class UserReportSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        # TODO(dcramer): add in various context from the event
        # context == user / http / extra interfaces
        if obj.resolution == UserReportResolution.NONE:
            resolution_label = 'none'
        elif obj.resolution == UserReportResolution.AWAITING_RESOLUTION:
            resolution_label = 'awaiting_resolution'
        elif obj.resolution == UserReportResolution.NOTIFIED:
            resolution_label = 'notified'
        else:
            resolution_label = 'unknown'

        return {
            'id': str(obj.id),
            'eventID': obj.event_id,
            'name': obj.name,
            'email': obj.email,
            'comments': obj.comments,
            'resolution': resolution_label,
            'dateCreated': obj.date_added,
        }
