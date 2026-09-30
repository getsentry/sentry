from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, cast, override

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.investigations.models import InvestigationSeen
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


class InvestigationSeenSerializerResponse(UserSerializerResponse):
    lastSeen: datetime


@register(InvestigationSeen)
class InvestigationSeenSerializer(Serializer):
    @override
    def get_attrs(
        self,
        item_list: Sequence[InvestigationSeen],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[InvestigationSeen, dict[str, Any]]:
        users = {
            serialized["id"]: serialized
            for serialized in user_service.serialize_many(
                filter={"user_ids": [seen.user_id for seen in item_list]},
                as_user=serialize_generic_user(user),
            )
        }
        return {seen: {"user": users.get(str(seen.user_id))} for seen in item_list}

    @override
    def serialize(
        self,
        obj: InvestigationSeen,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationSeenSerializerResponse | None:
        if attrs["user"] is None:
            return None
        return cast(
            InvestigationSeenSerializerResponse, {**attrs["user"], "lastSeen": obj.last_seen}
        )
