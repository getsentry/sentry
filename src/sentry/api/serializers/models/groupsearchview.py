from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.groupsearchview import GroupSearchView
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
    dateCreated: str | None
    dateUpdated: str | None


@register(GroupSearchView)
class GroupSearchViewSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        self.has_global_views = kwargs.pop("has_global_views", None)
        self.default_project = kwargs.pop("default_project", None)
        super().__init__(*args, **kwargs)

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
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
