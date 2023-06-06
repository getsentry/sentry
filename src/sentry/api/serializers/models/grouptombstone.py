from sentry.api.serializers import Serializer, register
from sentry.constants import LOG_LEVELS
from sentry.models import GroupTombstone
from sentry.services.hybrid_cloud.user.service import user_service


@register(GroupTombstone)
class GroupTombstoneSerializer(Serializer):
    def get_attrs(self, item_list, user):
        user_list = user_service.serialize_many(
            filter={"user_ids": [item.actor_id for item in item_list]}
        )
        users = {int(u["id"]): u for u in user_list}

        attrs = {}
        for item in item_list:
            attrs[item] = {"user": users.get(item.actor_id, {})}
        return attrs

    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "level": LOG_LEVELS.get(obj.level, "unknown"),
            "message": obj.message,
            "culprit": obj.culprit,
            "type": obj.get_event_type(),
            "metadata": obj.get_event_metadata(),
            "actor": attrs.get("user"),
        }
