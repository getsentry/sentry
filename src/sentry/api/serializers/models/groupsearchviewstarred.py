from typing import TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.groupsearchview import (
    GroupSearchViewSerializer,
)
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.savedsearch import SORT_LITERALS


class GroupSearchViewStarredSerializerResponse(TypedDict):
    id: str
    name: str
    query: str
    querySort: SORT_LITERALS
    projects: list[int]
    environments: list[str]
    timeFilters: dict
    lastVisited: str | None
    dateCreated: str
    dateUpdated: str


@register(GroupSearchViewStarred)
class GroupSearchViewStarredSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        self.organization = kwargs.pop("organization", None)
        super().__init__(*args, **kwargs)

    def get_attrs(self, item_list, user, **kwargs):
        views = [item.group_search_view for item in item_list]
        serialized_views = serialize(
            views,
            user,
            serializer=GroupSearchViewSerializer(organization=self.organization),
        )
        return dict(zip(item_list, serialized_views))

    def serialize(self, obj, attrs, user, **kwargs) -> GroupSearchViewStarredSerializerResponse:
        return attrs
