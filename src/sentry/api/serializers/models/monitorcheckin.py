from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import MonitorCheckIn


@register(MonitorCheckIn)
class MonitorCheckInSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.guid),
            "status": obj.get_status_display(),
            "duration": obj.duration,
            "dateCreated": obj.date_added,
        }
