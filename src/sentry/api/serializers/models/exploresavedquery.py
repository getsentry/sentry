from collections import defaultdict
from typing import DefaultDict, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryDataset,
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


@register(ExploreSavedQuery)
class ExploreSavedQueryModelSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        result: DefaultDict[str, dict] = defaultdict(lambda: {"created_by": {}})

        starred_query_ids = set(
            ExploreSavedQueryStarred.objects.filter(
                explore_saved_query__in=item_list,
                user_id=user.id,
                organization=item_list[0].organization if item_list else None,
            ).values_list("explore_saved_query_id", flat=True)
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
        serialized_users = {user["id"]: user for user in service_serialized}

        for explore_saved_query in item_list:
            result[explore_saved_query]["created_by"] = serialized_users.get(
                str(explore_saved_query.created_by_id)
            )
            result[explore_saved_query]["starred"] = explore_saved_query.id in starred_query_ids

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
            "lastVisited": obj.last_visited,
            "createdBy": attrs.get("created_by"),
            "starred": attrs.get("starred"),
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
