from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Release


@register(Release)
class ReleaseSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'version': obj.version,
            'environment': obj.environment,
            'ref': obj.ref,
            'url': obj.url,
            'dateStarted': obj.date_started,
            'dateReleased': obj.date_released,
            'dateCreated': obj.date_added,
            'data': obj.data,
        }
        return d
