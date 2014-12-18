from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import AccessGroup


@register(AccessGroup)
class AccessGroupSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'name': obj.name,
            'access': obj.get_type_display(),
            'managed': obj.managed,
            'dateCreated': obj.date_added,
        }
        return d
