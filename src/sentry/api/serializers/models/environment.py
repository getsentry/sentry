from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Environment


@register(Environment)
class EnvironmentSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'name': obj.name,
        }
