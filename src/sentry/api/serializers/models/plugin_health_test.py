from __future__ import absolute_import
from sentry.api.serializers import Serializer


class PluginHealthTestSerializer(Serializer):

    def serialize(self, obj, attrs, user):
        return {
            'plugin': obj.plugin.name,
            'dateCreated': obj.date_added,
            'test_results': obj.test_data,
        }
