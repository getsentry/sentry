from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Repository


@register(Repository)
class RepositorySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'name': obj.name,
            'dateCreated': obj.date_added,
        }
