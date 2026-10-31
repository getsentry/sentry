from collections.abc import Mapping, Sequence
from typing import cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer
from sentry.search.utils import convert_user_tag_to_query
from sentry.tagstore.types import GroupTagValue
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.eventuser import EventUser


class UserTagValueSerializer(Serializer):
    def __init__(self, project_id: int) -> None:
        self.project_id = project_id

    def get_attrs(
        self,
        item_list: Sequence[GroupTagValue],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[GroupTagValue, dict[str, EventUser | None]]:
        users = EventUser.for_tags(project_id=self.project_id, values=[t.value for t in item_list])
        result: dict[GroupTagValue, dict[str, EventUser | None]] = {}
        for item in item_list:
            result[item] = {"user": users.get(item.value) if item.value is not None else None}
        return result

    def serialize(
        self,
        obj: GroupTagValue,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[str, object]:
        result: dict[str, object] = {}
        if isinstance(attrs["user"], EventUser):
            result = cast(dict[str, object], attrs["user"].serialize())
        else:
            result = {"id": None}

        query = convert_user_tag_to_query("user", obj.value) if obj.value is not None else None
        if query:
            result["query"] = query

        result.update(
            {
                "value": obj.value,
                "count": obj.times_seen,
                "lastSeen": obj.last_seen,
                "firstSeen": obj.first_seen,
            }
        )
        return result
