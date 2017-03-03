from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import GroupHash


@register(GroupHash)
class GroupHashSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': obj.hash,
        }
