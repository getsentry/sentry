from __future__ import absolute_import

import six
from sentry.api.serializers import Serializer, register
from sentry.models import DiscoverSavedQuery


@register(DiscoverSavedQuery)
class DiscoverSavedQuerySerializer(Serializer):
    def serialize(self, obj, attrs, user, *args, **kwargs):

        query_keys = [
            'fields',
            'conditions',
            'aggregations',
            'range',
            'start',
            'end',
            'orderby',
            'limit'
        ]

        data = {
            'id': six.text_type(obj.id),
            'name': obj.name,
            'projects': [project.id for project in obj.projects.all()],
            'dateCreated': obj.date_created,
            'dateUpdated': obj.date_updated,
            'createdBy': six.text_type(obj.created_by.id) if obj.created_by else None,
        }

        for key in query_keys:
            if obj.query.get(key) is not None:
                data[key] = obj.query[key]

        return data
