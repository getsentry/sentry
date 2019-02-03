from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Monitor


@register(Monitor)
class MonitorSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.guid),
            'status': obj.get_status_display(),
            'type': obj.get_type_display(),
            'name': obj.name,
            'lastCheckIn': obj.last_checkin,
            'nextCheckIn': obj.next_checkin,
            'dateCreated': obj.date_added,
        }
