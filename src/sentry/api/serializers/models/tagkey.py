from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import TagKey


@register(TagKey)
class TagKeySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'key': TagKey.get_standardized_key(obj.key),
            'name': obj.get_label(),
            'uniqueValues': obj.values_seen,
        }
