from __future__ import absolute_import

from sentry.api.serializers import register, Serializer
from sentry.models import ProjectPlatform


@register(ProjectPlatform)
class ProjectPlatformSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {'platform': obj.platform, 'dateCreated': obj.date_added}
