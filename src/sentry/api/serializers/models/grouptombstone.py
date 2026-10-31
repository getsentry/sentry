from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.constants import LOG_LEVELS
from sentry.models.grouptombstone import GroupTombstone
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


class GroupTombstoneSerializerResponse(TypedDict):
    id: str
    level: str
    message: str
    culprit: str | None
    type: str
    metadata: dict[str, object]
    actor: dict[str, object]
    timesSeen: int
    lastSeen: datetime | None
    dateAdded: datetime | None


@register(GroupTombstone)
class GroupTombstoneSerializer(Serializer[GroupTombstoneSerializerResponse]):
    def get_attrs(
        self,
        item_list: Sequence[GroupTombstone],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[GroupTombstone, dict[str, object]]:
        user_list = user_service.serialize_many(
            filter={"user_ids": [item.actor_id for item in item_list if item.actor_id is not None]}
        )
        users = {int(u["id"]): u for u in user_list}

        attrs = {}
        for item in item_list:
            attrs[item] = {"user": users.get(item.actor_id, {})}
        return attrs

    def serialize(
        self,
        obj: GroupTombstone,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> GroupTombstoneSerializerResponse:
        return {
            "id": str(obj.id),
            "level": LOG_LEVELS.get(obj.level, "unknown"),
            "message": obj.message,
            "culprit": obj.culprit,
            "type": obj.get_event_type(),
            "metadata": obj.get_event_metadata(),
            "actor": cast(dict[str, object], attrs["user"]),
            "timesSeen": obj.times_seen,
            "lastSeen": obj.last_seen,
            "dateAdded": obj.date_added,
        }
