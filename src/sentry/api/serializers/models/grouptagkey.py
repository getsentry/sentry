from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.api.serializers import Serializer, register
from sentry.models import GroupTagKey


@register(GroupTagKey)
class GroupTagKeySerializer(Serializer):
    def get_attrs(self, item_list, user):
        result = {}
        for item in item_list:
            key = tagstore.get_standardized_key(item.key)
            result[item] = {
                'name': tagstore.get_tag_key_label(item.key),
                'key': key,
            }

        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'name': attrs['name'],
            'key': attrs['key'],
            'uniqueValues': obj.values_seen,
        }
