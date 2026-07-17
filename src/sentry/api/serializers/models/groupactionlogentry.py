from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.models.activity import _ActivitySentryAppEmbed
from sentry.issues.action_log.types import GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.types.activity import ActivityType
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.utils.action_log.activity_translator import ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE

# Mirror GroupActionTypes are serialized with the same `type` string as their
# equivalent Activity so the frontend can consume both identically.
_GROUP_ACTION_TYPE_TO_ACTIVITY_TYPE = {
    action_cls.get_type().value: activity_type
    for activity_type, action_cls in ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.items()
}


class GroupActionLogEntrySerializerResponse(TypedDict):
    id: str
    # The serialized acting user when actorType is USER, otherwise null.
    user: dict[str, Any] | None
    sentry_app: _ActivitySentryAppEmbed | None
    type: str
    data: dict[str, Any]
    dateCreated: datetime


@register(GroupActionLogEntry)
class GroupActionLogEntrySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        user_ids = [i.actor_id for i in item_list if i.actor_id]
        users = {}
        if user_ids:
            user_list = user_service.serialize_many(
                filter={"user_ids": user_ids}, as_user=serialize_generic_user(user)
            )
            users = {u["id"]: u for u in user_list}

        return {
            item: {
                "user": (
                    users.get(str(item.actor_id))
                    if item.actor_type == GroupActorType.USER
                    else None
                )
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user, **kwargs) -> GroupActionLogEntrySerializerResponse:
        activity_type = _GROUP_ACTION_TYPE_TO_ACTIVITY_TYPE.get(obj.type)
        type_display = (
            ActivityType(activity_type).name.lower()
            if activity_type is not None
            else obj.get_type_display()
        )
        return {
            "id": str(obj.id),
            "type": type_display,
            "user": attrs["user"],
            "sentry_app": None,  # mimic Activity serializer
            "data": obj.data or {},
            "dateCreated": obj.date_added,
        }
