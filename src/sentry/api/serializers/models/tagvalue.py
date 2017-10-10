from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import EventUser, TagValue


@register(TagValue)
class TagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        result = {}
        for item in item_list:
            result[item] = {
                'name': tagstore.get_tag_value_label(item.key, item.value),
            }
        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'key': tagstore.get_standardized_key(obj.key),
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
        result.update(
            {
                'value': obj.value,
                'count': obj.times_seen,
                'lastSeen': obj.last_seen,
                'firstSeen': obj.first_seen,
            }
        )
        return result
