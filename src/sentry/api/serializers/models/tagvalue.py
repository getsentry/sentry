from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import EventUser, TagKey, TagValue


@register(TagValue)
class TagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        user_tags = [
            i.value
            for i in item_list
            if i.key == 'sentry:user'
        ]

        tag_labels = {}
        if user_tags:
            tag_labels.update({
                ('sentry:user', k): v.get_label()
                for k, v in six.iteritems(EventUser.for_tags(
                    project_id=item_list[0].project_id,
                    values=user_tags,
                ))
            })

        result = {}
        for item in item_list:
            try:
                label = tag_labels[(item.key, item.value)]
            except KeyError:
                label = item.get_label()
            result[item] = {
                'name': label,
            }
        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'key': TagKey.get_standardized_key(obj.key),
            'name': attrs['name'],
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }


class EnvironmentTagValueSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'name': obj.value,
        }


class UserTagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        users = EventUser.for_tags(
            project_id=item_list[0].project_id,
            values=[t.value for t in item_list],
        )

        result = {}
        for item in item_list:
            result[item] = {
                'user': users.get(item.value),
            }
        return result

    def serialize(self, obj, attrs, user):
        if not attrs['user']:
            result = {
                'id': None,
            }
        else:
            result = serialize(attrs['user'], user)
        result.update({
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        })
        return result
