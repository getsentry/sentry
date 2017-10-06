from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.api.serializers import Serializer, register
from sentry.models import GroupTagValue, Release


@register(GroupTagValue)
class GroupTagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        result = {}
        for item in item_list:
            label = item.value
            if item.key == 'sentry:user':
                if item.value.startswith('id:'):
                    label = item.value[len('id:'):]
                elif item.value.startswith('email:'):
                    label = item.value[len('email:'):]
                elif item.value.startswith('username:'):
                    label = item.value[len('username:'):]
                elif item.value.startswith('ip:'):
                    label = item.value[len('ip:'):]
            elif item.key == 'sentry:release':
                label = Release.get_display_version(item.value)

            result[item] = {
                'name': label,
            }

        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'name': attrs['name'],
            'key': tagstore.get_standardized_key(obj.key),
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
