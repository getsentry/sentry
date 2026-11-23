from collections.abc import Mapping, Sequence
from typing import Any, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.groupseen import GroupSeen
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


@register(GroupSeen)
class GroupSeenSerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[GroupSeen],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[GroupSeen, dict[str, object]]:
        serialized_users = user_service.serialize_many(
            filter=dict(user_ids=[i.user_id for i in item_list]),
            as_user=serialize_generic_user(user),
        )
        user_map: dict[str, object] = {}
        for serialized in serialized_users:
            user_map[serialized["id"]] = serialized

        result: dict[GroupSeen, dict[str, object]] = {}
        for item in item_list:
            user_id_str = str(item.user_id)
            # Deleted users may have stale groupseen references as the "cascade deletion" is
            # eventually consistent. We omit this groupseen data as it's no longer valid.
            if user_id_str in user_map:
                result[item] = {"user": user_map[user_id_str]}
        return result

    def serialize(
        self,
        obj: GroupSeen,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[str, object] | None:
        data = cast("dict[str, object] | None", attrs.get("user"))
        if data is None:
            return None

        data["lastSeen"] = obj.last_seen
        return data
