from sentry.api.serializers import Serializer, register
from sentry.models.groupseen import GroupSeen
from sentry.users.services.user.service import user_service


@register(GroupSeen)
class GroupSeenSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        serialized_users = user_service.serialize_many(
            filter=dict(user_ids=[i.user_id for i in item_list]), as_user=user
        )
        user_map = {}
        for serialized in serialized_users:
            user_map[serialized["id"]] = serialized

        result = {}
        for item in item_list:
            user_id_str = str(item.user_id)
            # Deleted users may have stale groupseen references as the "cascade deletion" is
            # eventually consistent. We omit this groupseen data as it's no longer valid.
            if user_id_str in user_map:
                result[item] = {"user": user_map[user_id_str]}
        return result

    def serialize(self, obj, attrs, user, **kwargs):
        data = attrs.get("user")
        if data is None:
            return None

        data["lastSeen"] = obj.last_seen
        return data
