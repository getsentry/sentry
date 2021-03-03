from sentry.api.serializers import Serializer, register, serialize
from sentry.models import GroupSeen


@register(GroupSeen)
class GroupSeenSerializer(Serializer):
    def get_attrs(self, item_list, user):
        user_map = {d["id"]: d for d in serialize({i.user for i in item_list}, user)}

        result = {}
        for item in item_list:
            result[item] = {"user": user_map[str(item.user_id)]}
        return result

    def serialize(self, obj, attrs, user):
        data = attrs["user"]
        data["lastSeen"] = obj.last_seen
        return data
