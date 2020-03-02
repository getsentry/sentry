from __future__ import absolute_import

import six


from sentry.api.serializers import Serializer, register, serialize
from sentry.constants import LOG_LEVELS
from sentry.models import GroupTombstone, User
from sentry.utils.compat import zip


@register(GroupTombstone)
class GroupTombstoneSerializer(Serializer):
    def get_attrs(self, item_list, user):
        user_list = list(User.objects.filter(id__in=[item.actor_id for item in item_list]))
        users = {u.id: d for u, d in zip(user_list, serialize(user_list, user))}

        attrs = {}
        for item in item_list:
            attrs[item] = {"user": users.get(item.actor_id, {})}
        return attrs

    def serialize(self, obj, attrs, user):
        return {
            "id": six.text_type(obj.id),
            "level": LOG_LEVELS.get(obj.level, "unknown"),
            "message": obj.message,
            "culprit": obj.culprit,
            "type": obj.get_event_type(),
            "metadata": obj.get_event_metadata(),
            "actor": attrs.get("user"),
        }
