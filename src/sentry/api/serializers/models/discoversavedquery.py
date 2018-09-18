from __future__ import absolute_import

import six
from sentry.api.serializers import Serializer, register
from sentry.models import DiscoverSavedQuery


@register(DiscoverSavedQuery)
class DiscoverSavedQuerySerializer(Serializer):
    def serialize(self, obj, attrs, user, *args, **kwargs):
        return {
            'id': six.text_type(obj.id),
            'name': obj.name,
            'query': obj.query,
            'dateCreated': obj.date_created,
            'dateUpdated': obj.date_updated,
        }
