from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Release


@register(Release)
class ReleaseSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'version': obj.version,
            'dateCreated': obj.date_added,
        }
        return d
