from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.api.serializers import Serializer, register
from sentry.models import GroupTagKey


@register(GroupTagKey)
class GroupTagKeySerializer(Serializer):
    def get_attrs(self, item_list, user):
        tag_labels = {
            t.key: t.get_label()
            for t in
            tagstore.get_tag_keys(item_list[0].project_id, [i.key for i in item_list])
        }

        result = {}
        for item in item_list:
            key = tagstore.get_standardized_key(item.key)
            try:
                label = tag_labels[item.key]
            except KeyError:
                label = key
            result[item] = {
                'name': label,
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
