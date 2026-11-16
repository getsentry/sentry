from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Annotated, Literal, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.auth.principal import has_user
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryDataset,
    ExploreSavedQueryLastVisited,
    ExploreSavedQueryStarred,
)
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp

ExploreSavedQueryDatasetType = Literal[
    "spans", "logs", "segment_spans", "metrics", "replays", "ai_conversations"
]
ExploreSavedQueryMode = Literal["samples", "aggregate"]


class MetricResponseTypeOptional(TypedDict, total=False):
    unit: Annotated[str | None, ApiDescription("Unit of the metric. Null when it has none")]


class MetricResponseType(MetricResponseTypeOptional):
    name: Annotated[str, ApiDescription("Name of the metric")]
    type: Annotated[
        Literal["counter", "gauge", "distribution"], ApiDescription("Type of the metric")
    ]


class VisualizeResponseTypeOptional(TypedDict, total=False):
    chartType: Annotated[int, ApiDescription("Chart type used to plot the aggregates")]
    transformations: Annotated[
        list[str], ApiDescription("Transformations applied to the plotted series")
    ]


class VisualizeResponseType(VisualizeResponseTypeOptional):
    yAxes: Annotated[list[str], ApiDescription("Aggregates to plot")]


class AggregateFieldResponseType(TypedDict, total=False):
    chartType: Annotated[int, ApiDescription("Chart type used to plot the aggregates")]
    yAxes: Annotated[list[str], ApiDescription("Aggregates to plot")]
    groupBy: Annotated[str, ApiDescription("Field to group the aggregates by")]
    transformations: Annotated[
        list[str], ApiDescription("Transformations applied to the plotted series")
    ]


class QueryResponseTypeOptional(TypedDict, total=False):
    fields: Annotated[list[str] | None, ApiDescription("Fields shown in the samples table")]
    orderby: Annotated[str | None, ApiDescription("Field the samples are sorted by")]
    groupby: Annotated[list[str] | None, ApiDescription("Fields the aggregates are grouped by")]
    query: Annotated[str | None, ApiDescription("Search query that filters the results")]
    visualize: Annotated[
        list[VisualizeResponseType] | None, ApiDescription("Charts shown for the query")
    ]
    aggregateField: Annotated[
        list[AggregateFieldResponseType] | None,
        ApiDescription("Aggregates and group-by fields shown in aggregate mode"),
    ]
    aggregateOrderby: Annotated[
        str | None, ApiDescription("Field the aggregate results are sorted by")
    ]
    metric: Annotated[
        MetricResponseType | None, ApiDescription("Metric the query reads, for metric queries")
    ]
    caseInsensitive: Annotated[bool, ApiDescription("Whether the search query ignores letter case")]


class QueryResponseType(QueryResponseTypeOptional):
    mode: Annotated[
        ExploreSavedQueryMode, ApiDescription("Whether the query shows samples or aggregates")
    ]


class CrossEventResponseTypeOptional(TypedDict, total=False):
    metric: MetricResponseType | None


class CrossEventResponseType(CrossEventResponseTypeOptional):
    query: str
    type: Literal["spans", "logs", "metrics"]


class ExploreSavedQueryResponseOptional(TypedDict, total=False):
    environment: list[str]
    query: list[QueryResponseType]
    statsPeriod: str
    start: str
    end: str
    interval: str
    crossEvents: list[CrossEventResponseType]
    agent: list[str]
    errorsOnly: bool


class ExploreSavedQueryChangedReasonType(TypedDict):
    orderby: Annotated[
        list[dict[str, str]] | None,
        ApiDescription("Sort orders dropped when the query was migrated. Null when none were"),
    ]
    equations: Annotated[
        list[dict[str, str | list[str]]] | None,
        ApiDescription("Equations dropped when the query was migrated. Null when none were"),
    ]
    columns: Annotated[list[str], ApiDescription("Columns dropped when the query was migrated")]


class ExploreSavedQueryResponse(ExploreSavedQueryResponseOptional):
    id: str
    name: str
    projects: list[int]
    dataset: ExploreSavedQueryDatasetType
    expired: bool
    dateAdded: datetime
    dateUpdated: datetime
    lastVisited: datetime | None
    createdBy: UserSerializerResponse | None
    starred: bool
    position: int | None
    isPrebuilt: bool
    changedReason: ExploreSavedQueryChangedReasonType | None


class ExploreSavedQueryAttrs(TypedDict, total=False):
    created_by: UserSerializerResponse | None
    user_last_visited: datetime | None
    starred: bool
    position: int | None


@register(ExploreSavedQuery)
class ExploreSavedQueryModelSerializer(Serializer[ExploreSavedQueryResponse]):
    def get_attrs(
        self,
        item_list: Sequence[ExploreSavedQuery],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[ExploreSavedQuery, dict[str, object]]:
        result: defaultdict[ExploreSavedQuery, dict[str, object]] = defaultdict(
            lambda: {"created_by": {}}
        )

        starred_queries = {}
        user_last_visited = {}
        if has_user(user):
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
            as_user=user if has_user(user) else None,
        )
        serialized_users = {user["id"]: user for user in service_serialized}

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

    def serialize(
        self,
        obj: ExploreSavedQuery,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ExploreSavedQueryResponse:
        query_keys = [
            "environment",
            "query",
            "statsPeriod",
            "start",
            "end",
            "interval",
            "crossEvents",
            "agent",
            "errorsOnly",
        ]
        dataset_name = ExploreSavedQueryDataset.get_type_name(obj.dataset)
        assert dataset_name is not None
        dataset_name = cast(ExploreSavedQueryDatasetType, dataset_name)
        data: ExploreSavedQueryResponse = {
            "id": str(obj.id),
            "name": obj.name,
            "projects": [project.id for project in obj.projects.all()],
            "dataset": dataset_name,
            "expired": False,
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
            "lastVisited": cast(datetime | None, attrs.get("user_last_visited")),
            "createdBy": cast(UserSerializerResponse | None, attrs.get("created_by")),
            "starred": cast(bool, attrs.get("starred")),
            "position": cast(int | None, attrs.get("position")),
            "isPrebuilt": obj.prebuilt_id is not None,
            "changedReason": obj.changed_reason,
        }

        for key in query_keys:
            if obj.query.get(key) is not None:
                data[key] = obj.query[key]  # type: ignore[literal-required]

        # Older rows stored the relative period as `range`.
        if data.get("statsPeriod") is None and obj.query.get("range") is not None:
            data["statsPeriod"] = obj.query["range"]

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
