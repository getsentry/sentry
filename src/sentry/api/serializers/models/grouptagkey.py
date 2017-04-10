from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import GroupTagKey, TagKey


@register(GroupTagKey)
class GroupTagKeySerializer(Serializer):
    def get_attrs(self, item_list, user):
        tag_labels = {
            t.key: t.get_label()
            for t in TagKey.objects.filter(
                project=item_list[0].project,
                key__in=[i.key for i in item_list]
            )
        }

        result = {}
        for item in item_list:
            key = TagKey.get_standardized_key(item.key)
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
