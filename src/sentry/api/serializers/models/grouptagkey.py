from __future__ import absolute_import

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
            try:
                label = tag_labels[item.key]
            except KeyError:
                if item.key.startswith('sentry:'):
                    label = item.key.split('sentry:', 1)[-1]
                else:
                    label = item.key
            result[item] = {
                'name': label,
            }
        return result

    def serialize(self, obj, attrs, user):
        if obj.key.startswith('sentry:'):
            key = obj.key.split('sentry:', 1)[-1]
        else:
            key = obj.key

        return {
            'name': attrs['name'],
            'key': key,
            'uniqueValues': obj.values_seen,
        }
