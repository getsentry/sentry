from collections import defaultdict
from typing import DefaultDict, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryDataset,
    ExploreSavedQueryLastVisited,
    ExploreSavedQueryStarred,
)
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.services.user.service import user_service
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp


class ExploreSavedQueryResponseOptional(TypedDict, total=False):
    environment: list[str]
    query: str
    range: str
    start: str
    end: str
    interval: str
    mode: str


class ExploreSavedQueryChangedReasonType(TypedDict):
    orderby: list[dict[str, str]] | None
    equations: list[dict[str, str | list[str]]] | None
    columns: list[str]


class ExploreSavedQueryResponse(ExploreSavedQueryResponseOptional):
    id: str
    name: str
    projects: list[int]
    dataset: str
    expired: bool
    dateAdded: str
    dateUpdated: str
    lastVisited: str
    createdBy: UserSerializerResponse
    starred: bool
    position: int | None
    isPrebuilt: bool
    changedReason: ExploreSavedQueryChangedReasonType | None


@register(ExploreSavedQuery)
class ExploreSavedQueryModelSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        result: DefaultDict[str, dict] = defaultdict(lambda: {"created_by": {}})

        starred_queries = dict(
            ExploreSavedQueryStarred.objects.filter(
                explore_saved_query__in=item_list,
                user_id=user.id,
                organization=item_list[0].organization if item_list else None,
                starred=True,
            ).values_list("explore_saved_query_id", "position")
        )
        user_last_visited = dict(
            ExploreSavedQueryLastVisited.objects.filter(
                explore_saved_query__in=item_list,
                user_id=user.id,
                organization=item_list[0].organization if item_list else None,
            ).values_list("explore_saved_query_id", "last_visited")
        )

        service_serialized = user_service.serialize_many(
            filter={
                "user_ids": [
                    explore_saved_query.created_by_id
                    for explore_saved_query in item_list
                    if explore_saved_query.created_by_id
                ]
            },
            as_user=user if user.id else None,
        )
        serialized_users = {user["id"]: user for user in service_serialized if user is not None}

        for explore_saved_query in item_list:
            result[explore_saved_query]["created_by"] = serialized_users.get(
                str(explore_saved_query.created_by_id)
            )
            if explore_saved_query.id in starred_queries:
                result[explore_saved_query]["starred"] = True
                result[explore_saved_query]["position"] = starred_queries[explore_saved_query.id]
            else:
                result[explore_saved_query]["starred"] = False
                result[explore_saved_query]["position"] = None
            if explore_saved_query.id in user_last_visited:
                result[explore_saved_query]["user_last_visited"] = user_last_visited[
                    explore_saved_query.id
                ]

        return result

    def serialize(self, obj, attrs, user, **kwargs) -> ExploreSavedQueryResponse:
        query_keys = [
            "environment",
            "query",
            "range",
            "start",
            "end",
            "interval",
        ]
        data: ExploreSavedQueryResponse = {
            "id": str(obj.id),
            "name": obj.name,
            "projects": [project.id for project in obj.projects.all()],
            "dataset": ExploreSavedQueryDataset.get_type_name(obj.dataset),
            "expired": False,
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
            "lastVisited": attrs.get("user_last_visited"),
            "createdBy": attrs.get("created_by"),
            "starred": attrs.get("starred"),
            "position": attrs.get("position"),
            "isPrebuilt": obj.prebuilt_id is not None,
            "changedReason": obj.changed_reason,
        }

        for key in query_keys:
            if obj.query.get(key) is not None:
                data[key] = obj.query[key]  # type: ignore[literal-required]

        # expire queries that are beyond the retention period
        if "start" in obj.query:
            start, end = parse_timestamp(obj.query["start"]), parse_timestamp(obj.query["end"])
            if start and end:
                expired, modified_start = outside_retention_with_modified_start(
                    start, end, obj.organization
                )
                data["expired"] = expired
                data["start"] = modified_start.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

        if obj.query.get("all_projects"):
            data["projects"] = list(ALL_ACCESS_PROJECTS)

        return data
