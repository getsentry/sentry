from __future__ import absolute_import

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import GroupSeen


@register(GroupSeen)
class GroupSeenSerializer(Serializer):
    def get_attrs(self, item_list, user):
        user_list = [i.user for i in item_list]
        user_map = {
            u: d
            for u, d in zip(user_list, serialize(user_list, user))
        }

        result = {}
        for item in item_list:
            result[item] = {
                'user': user_map[item.user],
            }
        return result

    def serialize(self, obj, attrs, user):
        data = attrs['user']
        data['lastSeen'] = obj.last_seen
        return data
