from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TypedDict, cast

from django.contrib.auth.models import AnonymousUser
from django.db.models import prefetch_related_objects

from sentry.api.serializers import Serializer, register
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization
from sentry.models.savedsearch import SORT_LITERALS
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


class GroupSearchViewTimeFilters(TypedDict, total=False):
    start: str | None
    end: str | None
    period: str | None
    utc: bool | None


class GroupSearchViewSerializerResponse(TypedDict):
    id: str
    createdBy: UserSerializerResponse | None
    name: str
    query: str
    querySort: SORT_LITERALS
    projects: list[int]
    environments: list[str]
    timeFilters: GroupSearchViewTimeFilters
    lastVisited: datetime | None
    dateCreated: datetime | None
    dateUpdated: datetime
    starred: bool
    stars: int


@register(GroupSearchView)
class GroupSearchViewSerializer(Serializer[GroupSearchViewSerializerResponse]):
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.organization = cast(Organization | None, kwargs.pop("organization", None))
        super().__init__(*args, **kwargs)

    def get_attrs(
        self,
        item_list: Sequence[GroupSearchView],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[GroupSearchView, dict[str, object]]:
        prefetch_related_objects(item_list, "projects")
        attrs: dict[GroupSearchView, dict[str, object]] = {}

        last_visited_views = (
            GroupSearchViewLastVisited.objects.filter(
                organization=self.organization,
                user_id=user.id,
                group_search_view_id__in=[item.id for item in item_list],
            )
            if not isinstance(user, AnonymousUser)
            else []
        )
        user_starred_view_ids = (
            set(
                GroupSearchViewStarred.objects.filter(
                    organization=self.organization,
                    user_id=user.id,
                ).values_list("group_search_view_id", flat=True)
            )
            if not isinstance(user, AnonymousUser)
            else set()
        )
        last_visited_map = {lv.group_search_view_id: lv for lv in last_visited_views}

        serialized_users: dict[str, dict[str, object]] = {
            cast(str, user["id"]): cast("dict[str, object]", user)
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

    def serialize(
        self,
        obj: GroupSearchView,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> GroupSearchViewSerializerResponse:
        projects = [-1] if obj.is_all_projects else [p.id for p in obj.projects.all()]

        return {
            "id": str(obj.id),
            "createdBy": cast(UserSerializerResponse | None, attrs.get("created_by")),
            "name": obj.name,
            "query": obj.query,
            # Model choices constrain query_sort to SortOptions values, which
            # exactly match SORT_LITERALS.
            "querySort": cast(SORT_LITERALS, obj.query_sort),
            "projects": projects,
            "environments": obj.environments,
            "timeFilters": obj.time_filters,
            "lastVisited": cast(datetime | None, attrs.get("last_visited", None)),
            "starred": cast(bool, attrs.get("starred", False)),
            "stars": cast(int, attrs.get("stars", 0)),
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
