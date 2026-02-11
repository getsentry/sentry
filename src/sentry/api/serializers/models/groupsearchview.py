from collections.abc import MutableMapping
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.savedsearch import SORT_LITERALS
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.services.user.service import user_service


class GroupSearchViewSerializerResponse(TypedDict):
    id: str
    createdBy: UserSerializerResponse | None
    name: str
    query: str
    querySort: SORT_LITERALS
    projects: list[int]
    environments: list[str]
    timeFilters: dict
    lastVisited: str | None
    dateCreated: str
    dateUpdated: str
    starred: bool
    stars: int


@register(GroupSearchView)
class GroupSearchViewSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        self.organization = kwargs.pop("organization", None)
        super().__init__(*args, **kwargs)

    def get_attrs(self, item_list, user, **kwargs) -> MutableMapping[Any, Any]:
        attrs: MutableMapping[Any, Any] = {}

        last_visited_views = GroupSearchViewLastVisited.objects.filter(
            organization=self.organization,
            user_id=user.id,
            group_search_view_id__in=[item.id for item in item_list],
        )
        user_starred_view_ids = set(
            GroupSearchViewStarred.objects.filter(
                organization=self.organization,
                user_id=user.id,
            ).values_list("group_search_view_id", flat=True)
        )
        last_visited_map = {lv.group_search_view_id: lv for lv in last_visited_views}

        serialized_users = {
            user["id"]: user
            for user in user_service.serialize_many(
                filter={"user_ids": [view.user_id for view in item_list if view.user_id]},
                as_user=user,
            )
            if user is not None
        }

        for item in item_list:
            last_visited = last_visited_map.get(item.id, None)
            attrs[item] = {}
            if last_visited:
                attrs[item]["last_visited"] = last_visited.last_visited
            attrs[item]["starred"] = item.id in user_starred_view_ids
            attrs[item]["stars"] = getattr(item, "popularity", 0)
            attrs[item]["created_by"] = serialized_users.get(str(item.user_id))
        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> GroupSearchViewSerializerResponse:
        projects = [-1] if obj.is_all_projects else list(obj.projects.values_list("id", flat=True))

        return {
            "id": str(obj.id),
            "createdBy": attrs.get("created_by"),
            "name": obj.name,
            "query": obj.query,
            "querySort": obj.query_sort,
            "projects": projects,
            "environments": obj.environments,
            "timeFilters": obj.time_filters,
            "lastVisited": attrs.get("last_visited", None),
            "starred": attrs.get("starred", False),
            "stars": attrs.get("stars", 0),
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
