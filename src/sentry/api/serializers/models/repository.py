from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import Repository


@register(Repository)
class RepositorySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        if obj.provider:
            provider = {
                'id': obj.provider,
                'name': obj.get_provider().name,
            }
        else:
            provider = {
                'id': 'unknown',
                'name': 'Unknown Provider',
            }
        return {
            'id': six.text_type(obj.id),
            'name': obj.name,
            'url': obj.url,
            'provider': provider,
            'status': obj.get_status_display(),
            'dateCreated': obj.date_added,
        }
