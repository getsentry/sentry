from typing import TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.groupsearchview import (
    GroupSearchViewSerializer,
    GroupSearchViewSerializerResponse,
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
        self.has_global_views = kwargs.pop("has_global_views", None)
        self.default_project = kwargs.pop("default_project", None)
        self.organization = kwargs.pop("organization", None)
        super().__init__(*args, **kwargs)

    def serialize(self, obj, attrs, user, **kwargs) -> GroupSearchViewStarredSerializerResponse:
        serialized_view: GroupSearchViewSerializerResponse = serialize(
            obj.group_search_view,
            user,
            serializer=GroupSearchViewSerializer(
                has_global_views=self.has_global_views,
                default_project=self.default_project,
                organization=self.organization,
            ),
        )

        return serialized_view
