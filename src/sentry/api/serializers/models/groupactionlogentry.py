from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.issues.action_log.types import GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


class GroupActionLogEntrySerializerResponse(TypedDict):
    id: str
    type: str
    actorType: str
    # The serialized acting user when actorType is USER, otherwise null.
    user: dict[str, Any] | None
    actorId: str
    source: str
    data: dict[str, Any]
    dateAdded: datetime


@register(GroupActionLogEntry)
class GroupActionLogEntrySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        user_ids = [
            i.actor_id for i in item_list if i.actor_type == GroupActorType.USER and i.actor_id
        ]
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
        return {
            "id": str(obj.id),
            "type": obj.get_type_display(),
            # "actorType": obj.get_actor_type_display(),
            "user": attrs["user"],  # TODO compare with Activity serializer
            # "actorId": str(obj.actor_id),
            # "source": obj.source,
            "sentry_app": None,  # mimic Activity serializer
            "data": obj.data or {},
            "dateCreated": obj.date_added,
        }
