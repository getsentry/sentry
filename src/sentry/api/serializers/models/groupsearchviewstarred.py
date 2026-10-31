from collections.abc import Mapping, Sequence
from typing import cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.groupsearchview import (
    GroupSearchViewSerializer,
    GroupSearchViewSerializerResponse,
)
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

GroupSearchViewStarredSerializerResponse = GroupSearchViewSerializerResponse


@register(GroupSearchViewStarred)
class GroupSearchViewStarredSerializer(Serializer[GroupSearchViewStarredSerializerResponse]):
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.organization = cast(Organization | None, kwargs.pop("organization", None))
        super().__init__(*args, **kwargs)

    def get_attrs(
        self,
        item_list: Sequence[GroupSearchViewStarred],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[GroupSearchViewStarred, GroupSearchViewSerializerResponse]:
        views = [item.group_search_view for item in item_list]
        serialized_views = serialize(
            views,
            user,
            serializer=GroupSearchViewSerializer(organization=self.organization),
        )
        return dict(zip(item_list, serialized_views))

    def serialize(
        self,
        obj: GroupSearchViewStarred,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> GroupSearchViewStarredSerializerResponse:
        return cast(GroupSearchViewStarredSerializerResponse, attrs)
