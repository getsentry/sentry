from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import HelpPage


@register(HelpPage)
class HelpPageSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'title': obj.title,
        }
        return d
