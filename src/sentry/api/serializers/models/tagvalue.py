from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer
from sentry.search.utils import convert_user_tag_to_query
from sentry.utils.eventuser import EventUser


class UserTagValueSerializerResponseOptional(TypedDict, total=False):
    username: str | None
    email: str | None
    name: str | None
    ipAddress: str | None
    avatarUrl: str | None
    query: str | None


class UserTagValueSerializerResponse(UserTagValueSerializerResponseOptional):
    id: str | None
    value: str | None
    count: int | None
    lastSeen: datetime | None
    firstSeen: datetime | None


class UserTagValueSerializer(Serializer[UserTagValueSerializerResponse]):
    def __init__(self, project_id: int):
        self.project_id = project_id

    def get_attrs(self, item_list, user, **kwargs):
        users = EventUser.for_tags(project_id=self.project_id, values=[t.value for t in item_list])
        result = {}
        for item in item_list:
            result[item] = {"user": users.get(item.value)}
        return result

    def serialize(self, obj, attrs, user, **kwargs) -> UserTagValueSerializerResponse:
        result: UserTagValueSerializerResponse = {
            "id": None,
            "value": obj.value,
            "count": obj.times_seen,
            "lastSeen": obj.last_seen,
            "firstSeen": obj.first_seen,
        }
        if isinstance(attrs["user"], EventUser):
            user_data = attrs["user"].serialize()
            result.update(
                {
                    "id": user_data["id"],
                    "username": user_data["username"],
                    "email": user_data["email"],
                    "name": user_data["name"],
                    "ipAddress": user_data["ipAddress"],
                    "avatarUrl": user_data["avatarUrl"],
                }
            )

        query = convert_user_tag_to_query("user", obj.value)
        if query:
            result["query"] = query

        return result
