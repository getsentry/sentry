from collections import defaultdict
from typing import DefaultDict, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.services.user.service import user_service
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp

DATASET_SOURCES = dict(DatasetSourcesTypes.as_choices())


class DiscoverSavedQueryResponseOptional(TypedDict, total=False):
    environment: list[str]
    query: str
    fields: list[str]
    widths: list[str]
    conditions: list[str]
    aggregations: list[str]
    range: str
    start: str
    end: str
    orderby: str
    limit: str
    yAxis: list[str]
    display: str
    topEvents: int
    interval: str
    exploreQuery: dict


class DiscoverSavedQueryResponse(DiscoverSavedQueryResponseOptional):
    id: str
    name: str
    projects: list[int]
    version: int
    queryDataset: str
    datasetSource: str
    expired: bool
    dateCreated: str
    dateUpdated: str
    createdBy: UserSerializerResponse


@register(DiscoverSavedQuery)
class DiscoverSavedQueryModelSerializer(Serializer):
    def partial_serialize_explore_query(self, query: ExploreSavedQuery) -> dict:
        query_keys = [
            "environment",
            "query",
            "range",
            "start",
            "end",
            "interval",
        ]
        data = {
            "id": str(query.id),
            "name": query.name,
            "projects": [project.id for project in query.projects.all()],
            "dataset": ExploreSavedQueryDataset.get_type_name(query.dataset),
            "expired": False,
            "isPrebuilt": query.prebuilt_id is not None,
            "changedReason": query.changed_reason,
        }

        for key in query_keys:
            if query.query.get(key) is not None:
                data[key] = query.query[key]

        # expire queries that are beyond the retention period
        if "start" in query.query:
            start, end = parse_timestamp(query.query["start"]), parse_timestamp(query.query["end"])
            if start and end:
                expired, modified_start = outside_retention_with_modified_start(
                    start, end, query.organization
                )
                data["expired"] = expired
                data["start"] = modified_start.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

        if query.query.get("all_projects"):
            data["projects"] = list(ALL_ACCESS_PROJECTS)

        return data

    def get_attrs(self, item_list, user, **kwargs):
        result: DefaultDict[str, dict] = defaultdict(
            lambda: {"created_by": {}, "explore_query": None}
        )

        service_serialized = user_service.serialize_many(
            filter={
                "user_ids": [
                    discover_saved_query.created_by_id
                    for discover_saved_query in item_list
                    if discover_saved_query.created_by_id
                ]
            },
            as_user=user if user.id else None,
        )
        serialized_users = {user["id"]: user for user in service_serialized}

        # Batch fetch and serialize explore queries
        explore_query_ids = [
            discover_query.explore_query_id
            for discover_query in item_list
            if discover_query.explore_query_id is not None
            and discover_query.dataset == DiscoverSavedQueryTypes.TRANSACTION_LIKE
        ]
        if explore_query_ids:
            explore_queries = ExploreSavedQuery.objects.filter(
                id__in=explore_query_ids
            ).prefetch_related("projects")
            serialized_explore_queries = {
                query.id: self.partial_serialize_explore_query(query) for query in explore_queries
            }
        else:
            serialized_explore_queries = {}

        for discover_saved_query in item_list:
            result[discover_saved_query]["created_by"] = serialized_users.get(
                str(discover_saved_query.created_by_id)
            )
            if discover_saved_query.explore_query_id in serialized_explore_queries:
                result[discover_saved_query]["explore_query"] = serialized_explore_queries.get(
                    discover_saved_query.explore_query_id
                )

        return result

    def serialize(self, obj, attrs, user, **kwargs) -> DiscoverSavedQueryResponse:
        query_keys = [
            "environment",
            "query",
            "fields",
            "widths",
            "conditions",
            "aggregations",
            "range",
            "start",
            "end",
            "orderby",
            "limit",
            "yAxis",
            "display",
            "topEvents",
            "interval",
        ]
        data: DiscoverSavedQueryResponse = {
            "id": str(obj.id),
            "name": obj.name,
            "projects": [project.id for project in obj.projects.all()],
            "version": obj.version or obj.query.get("version", 1),
            "queryDataset": DiscoverSavedQueryTypes.get_type_name(obj.dataset),
            "datasetSource": DATASET_SOURCES[obj.dataset_source],
            "expired": False,
            "dateCreated": obj.date_created,
            "dateUpdated": obj.date_updated,
            "createdBy": attrs.get("created_by"),
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

        if attrs.get("explore_query") is not None:
            data["exploreQuery"] = attrs.get("explore_query")

        return data
