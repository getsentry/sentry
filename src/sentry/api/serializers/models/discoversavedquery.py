from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Annotated, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.api.serializers.models.exploresavedquery import (
    ExploreSavedQueryChangedReasonType,
    ExploreSavedQueryDatasetType,
    QueryResponseType,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.auth.principal import has_user
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.discover.models import (
    DatasetSourcesTypes,
    DiscoverSavedQuery,
    DiscoverSavedQueryLastVisited,
    DiscoverSavedQueryStarred,
    DiscoverSavedQueryTypes,
)
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryDataset
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp

DATASET_SOURCES = dict(DatasetSourcesTypes.as_choices())


class DiscoverExploreQueryResponseOptional(TypedDict, total=False):
    environment: Annotated[
        list[str], ApiDescription("Names of the environments the query filters by")
    ]
    query: Annotated[list[QueryResponseType], ApiDescription("Queries shown in Explore")]
    statsPeriod: Annotated[str, ApiDescription("Relative time range of the query, such as 14d")]
    start: Annotated[str, ApiDescription("Start of the absolute time range (ISO 8601)")]
    end: Annotated[str, ApiDescription("End of the absolute time range (ISO 8601)")]
    interval: Annotated[str, ApiDescription("Resolution of the time series")]


class DiscoverExploreQueryResponse(DiscoverExploreQueryResponseOptional):
    id: Annotated[str, ApiDescription("ID of the Explore query")]
    name: Annotated[str, ApiDescription("Name of the Explore query")]
    projects: Annotated[list[int], ApiDescription("IDs of the projects the query covers")]
    dataset: Annotated[ExploreSavedQueryDatasetType, ApiDescription("Dataset the query reads")]
    expired: Annotated[
        bool, ApiDescription("Whether the query's time range is outside the retention period")
    ]
    isPrebuilt: Annotated[bool, ApiDescription("Whether Sentry provides the query")]
    changedReason: Annotated[
        ExploreSavedQueryChangedReasonType | None,
        ApiDescription("Parts of the Discover query dropped by the migration. Null when none were"),
    ]


class DiscoverSavedQueryResponseOptional(TypedDict, total=False):
    environment: Annotated[
        list[str], ApiDescription("Names of the environments the query filters by")
    ]
    query: Annotated[str, ApiDescription("Search query that filters the results")]
    fields: Annotated[
        list[str], ApiDescription("Fields, functions or equations the query requests")
    ]
    widths: Annotated[
        list[str], ApiDescription("Rendered column widths, in the same order as the query's fields")
    ]
    conditions: Annotated[
        list[str], ApiDescription("Filter conditions, each as a [column, operator, value] triple")
    ]
    aggregations: Annotated[
        list[str],
        ApiDescription("Aggregate functions to apply, each as a [function, column, alias] triple"),
    ]
    range: Annotated[str, ApiDescription("Saved relative time range, such as 14d")]
    start: Annotated[str, ApiDescription("Saved start time (ISO 8601)")]
    end: Annotated[str, ApiDescription("Saved end time (ISO 8601)")]
    orderby: Annotated[str, ApiDescription("How the query results are ordered")]
    limit: Annotated[str, ApiDescription("Maximum number of rows to return")]
    yAxis: Annotated[list[str], ApiDescription("Aggregate functions plotted on the chart")]
    display: Annotated[
        str, ApiDescription("Chart type for the saved query, such as default, top5, daily or bar")
    ]
    topEvents: Annotated[int, ApiDescription("Number of top events' time series to show")]
    interval: Annotated[str, ApiDescription("Resolution of the time series")]
    exploreQuery: Annotated[
        DiscoverExploreQueryResponse | None,
        ApiDescription("Explore query this saved query was migrated to. Null when there's none"),
    ]
    lastVisited: Annotated[
        datetime | None, ApiDescription("When the requesting user last viewed the query (ISO 8601)")
    ]
    starred: Annotated[bool, ApiDescription("Whether the requesting user starred the query")]
    position: Annotated[
        int | None,
        ApiDescription(
            "Position of the query in the requesting user's starred list. Null when it isn't starred"
        ),
    ]


class DiscoverSavedQueryResponse(DiscoverSavedQueryResponseOptional):
    id: Annotated[str, ApiDescription("ID of the saved query")]
    name: Annotated[str, ApiDescription("Name of the saved query")]
    projects: Annotated[
        list[int],
        ApiDescription("IDs of the projects the query filters by. [-1] means all projects"),
    ]
    version: Annotated[
        int,
        ApiDescription(
            "Schema version of the saved query: 1 for the legacy shape, 2 for the current one"
        ),
    ]
    queryDataset: Annotated[
        str, ApiDescription("Dataset the query runs on, such as error-events or transaction-like")
    ]
    datasetSource: Annotated[
        str, ApiDescription("How the dataset was chosen: unknown, inferred, user or forced")
    ]
    expired: Annotated[
        bool, ApiDescription("Whether the saved time range is outside data retention")
    ]
    dateCreated: Annotated[datetime, ApiDescription("When the saved query was created (ISO 8601)")]
    dateUpdated: Annotated[
        datetime, ApiDescription("When the saved query was last updated (ISO 8601)")
    ]
    createdBy: Annotated[
        UserSerializerResponse | None, ApiDescription("User who created the saved query")
    ]


@register(DiscoverSavedQuery)
class DiscoverSavedQueryModelSerializer(Serializer[DiscoverSavedQueryResponse]):
    def partial_serialize_explore_query(self, query: ExploreSavedQuery) -> dict[str, object]:
        query_keys = [
            "environment",
            "query",
            "statsPeriod",
            "start",
            "end",
            "interval",
        ]
        data: dict[str, object] = {
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

        # Older rows stored the relative period as `range`.
        if data.get("statsPeriod") is None and query.query.get("range") is not None:
            data["statsPeriod"] = query.query["range"]

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

    def get_attrs(
        self,
        item_list: Sequence[DiscoverSavedQuery],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> defaultdict[DiscoverSavedQuery, dict[str, object]]:
        result: defaultdict[DiscoverSavedQuery, dict[str, object]] = defaultdict(
            lambda: {"created_by": {}, "explore_query": None}
        )

        organization = item_list[0].organization if item_list else None

        starred_queries: dict[int, int | None] = {}
        user_last_visited: dict[int, datetime] = {}
        if has_user(user):
            starred_queries = dict(
                DiscoverSavedQueryStarred.objects.filter(
                    discover_saved_query__in=item_list,
                    user_id=user.id,
                    organization=item_list[0].organization if item_list else None,
                    starred=True,
                ).values_list("discover_saved_query_id", "position")
            )
            user_last_visited = dict(
                DiscoverSavedQueryLastVisited.objects.filter(
                    discover_saved_query__in=item_list,
                    user_id=user.id,
                    organization=organization,
                ).values_list("discover_saved_query_id", "last_visited")
            )

        service_serialized = user_service.serialize_many(
            filter={
                "user_ids": [
                    discover_saved_query.created_by_id
                    for discover_saved_query in item_list
                    if discover_saved_query.created_by_id
                ]
            },
            as_user=user if has_user(user) else None,
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
            if discover_saved_query.id in starred_queries:
                result[discover_saved_query]["starred"] = True
                result[discover_saved_query]["position"] = starred_queries[discover_saved_query.id]
            else:
                result[discover_saved_query]["starred"] = False
                result[discover_saved_query]["position"] = None
            result[discover_saved_query]["user_last_visited"] = user_last_visited.get(
                discover_saved_query.id
            )

        return result

    def serialize(
        self,
        obj: DiscoverSavedQuery,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> DiscoverSavedQueryResponse:
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
        dataset_name = DiscoverSavedQueryTypes.get_type_name(obj.dataset)
        assert dataset_name is not None
        data: DiscoverSavedQueryResponse = {
            "id": str(obj.id),
            "name": obj.name,
            "projects": [project.id for project in obj.projects.all()],
            "version": obj.version or obj.query.get("version", 1),
            "queryDataset": dataset_name,
            "datasetSource": DATASET_SOURCES[obj.dataset_source],
            "expired": False,
            "dateCreated": obj.date_created,
            "dateUpdated": obj.date_updated,
            "createdBy": cast(UserSerializerResponse | None, attrs.get("created_by")),
        }

        if "user_last_visited" in attrs:
            data["lastVisited"] = cast(datetime | None, attrs["user_last_visited"])

        if "starred" in attrs:
            data["starred"] = cast(bool, attrs["starred"])

        if "position" in attrs:
            data["position"] = cast(int | None, attrs["position"])

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
            data["exploreQuery"] = cast(
                DiscoverExploreQueryResponse | None, attrs.get("explore_query")
            )

        return data
