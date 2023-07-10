from sentry.api.serializers import Serializer, register
from sentry.models import GroupSeen
from sentry.services.hybrid_cloud.user.service import user_service


@register(GroupSeen)
class GroupSeenSerializer(Serializer):
    def get_attrs(self, item_list, user):
        serialized_users = user_service.serialize_many(
            filter=dict(user_ids=[i.user_id for i in item_list]), as_user=user
        )
        user_map = {}
        for serialized in serialized_users:
            user_map[serialized["id"]] = serialized

        result = {}
        for item in item_list:
            result[item] = {"user": user_map[str(item.user_id)]}
        return result

    def serialize(self, obj, attrs, user):
        data = attrs["user"]
        data["lastSeen"] = obj.last_seen
        return data
