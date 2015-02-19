from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import GroupTagValue


@register(GroupTagValue)
class GroupTagValueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'key': obj.key,
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
        return d
