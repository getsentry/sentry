from collections.abc import MutableMapping
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.savedsearch import SORT_LITERALS


class GroupSearchViewSerializerResponse(TypedDict):
    id: str
    name: str
    query: str
    querySort: SORT_LITERALS
    position: int
    projects: list[int]
    isAllProjects: bool
    environments: list[str]
    timeFilters: dict
    lastVisited: str | None
    dateCreated: str
    dateUpdated: str


@register(GroupSearchView)
class GroupSearchViewSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        self.has_global_views = kwargs.pop("has_global_views", None)
        self.default_project = kwargs.pop("default_project", None)
        super().__init__(*args, **kwargs)

    def get_attrs(self, item_list, user, **kwargs) -> MutableMapping[Any, Any]:
        attrs: MutableMapping[Any, Any] = {}

        organization = item_list[0].organization
        last_visited_views = GroupSearchViewLastVisited.objects.filter(
            organization=organization,
            user_id=user.id,
            group_search_view_id__in=[item.id for item in item_list],
        )
        last_visited_map = {lv.group_search_view_id: lv for lv in last_visited_views}

        for item in item_list:
            last_visited = last_visited_map.get(item.id, None)
            if last_visited:
                attrs[item] = {}
                attrs[item]["last_visited"] = last_visited.last_visited

        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> GroupSearchViewSerializerResponse:
        if self.has_global_views is False:
            is_all_projects = False

            projects = list(obj.projects.values_list("id", flat=True))
            num_projects = len(projects)
            if num_projects != 1:
                projects = [projects[0] if num_projects > 1 else self.default_project]

        else:
            is_all_projects = obj.is_all_projects
            projects = list(obj.projects.values_list("id", flat=True))

        return {
            "id": str(obj.id),
            "name": obj.name,
            "query": obj.query,
            "querySort": obj.query_sort,
            "position": obj.position,
            "projects": projects,
            "isAllProjects": is_all_projects,
            "environments": obj.environments,
            "timeFilters": obj.time_filters,
            "lastVisited": attrs["last_visited"] if attrs else None,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
