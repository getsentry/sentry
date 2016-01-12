from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import SavedSearch


@register(SavedSearch)
class SavedSearchSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'name': obj.name,
            'query': obj.query,
            'isDefault': obj.is_default,
            'dateCreated': obj.date_added,
        }
