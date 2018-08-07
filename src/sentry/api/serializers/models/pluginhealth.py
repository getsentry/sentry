from __future__ import absolute_import
from sentry.api.serializers import Serializer


class PluginHealthSerializer(Serializer):

    def serialize(self, obj, attrs, user):
        return {
            'name': obj.name,
            'featuresList': obj.features_list,
            'dateCreated': obj.date_added,
            'link': obj.link,
            'author': obj.author,
            'metadata': obj.metadata,
            'status': obj.status,
        }
