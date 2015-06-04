from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import Rule


@register(Rule)
class RuleSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'name': obj.label,
            'dateCreated': obj.date_added,
        }
        return d
