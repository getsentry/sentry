from sentry.api.serializers import Serializer, register
from sentry.incidents.models import IncidentSeen
from sentry.services.hybrid_cloud.user.serial import serialize_generic_user
from sentry.services.hybrid_cloud.user.service import user_service


@register(IncidentSeen)
class IncidentSeenSerializer(Serializer):
    def get_attrs(self, item_list, user):
        item_users = user_service.serialize_many(
            filter={
                "user_ids": [i.user_id for i in item_list],
            },
            as_user=serialize_generic_user(user),
        )
        user_map = {d["id"]: d for d in item_users}

        result = {}
        for item in item_list:
            result[item] = {"user": user_map[str(item.user_id)]}
        return result

    def serialize(self, obj, attrs, user):
        data = attrs["user"]
        data["lastSeen"] = obj.last_seen
        return data
