from __future__ import annotations

from typing import Any, Literal

import sentry_sdk
from django.db.models import (
    Case,
    CharField,
    F,
    IntegerField,
    OrderBy,
    QuerySet,
    Value,
    When,
)
from django.db.models.functions import Lower
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.discoversavedquery import (
    DiscoverSavedQueryModelSerializer,
    DiscoverSavedQueryResponse,
)
from sentry.api.serializers.models.exploresavedquery import (
    ExploreSavedQueryModelSerializer,
    ExploreSavedQueryResponse,
)
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import (
    CursorQueryParam,
    ExploreSavedQueriesParams,
    GlobalParams,
    VisibilityParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.discover.endpoints.bases import filter_to_accessible_discover_queries
from sentry.discover.models import (
    DiscoverSavedQuery,
    DiscoverSavedQueryTypes,
)
from sentry.explore.endpoints.bases import (
    ExploreSavedQueryPermission,
    filter_to_accessible_explore_queries,
)
from sentry.explore.endpoints.explore_saved_queries import (
    sync_prebuilt_queries,
    sync_prebuilt_queries_starred,
)
from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryDataset,
)
from sentry.explore.types import SavedQueryType
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.search.utils import tokenize_query
from sentry.utils.locking import UnableToAcquireLock


class CombinedDiscoverSavedQueryResponse(DiscoverSavedQueryResponse):
    queryType: Literal[SavedQueryType.DISCOVER]


class CombinedExploreSavedQueryResponse(ExploreSavedQueryResponse):
    queryType: Literal[SavedQueryType.EXPLORE]


def get_discover_queryset(
    request: Request, organization: Organization, user_id: int
) -> QuerySet[DiscoverSavedQuery]:
    """Returns the Discover queryset filtering out homepage queries"""
    queryset: QuerySet[DiscoverSavedQuery] = DiscoverSavedQuery.objects.filter(
        organization=organization
    ).exclude(is_homepage=True)

    # Hide transactions saved queries if organizations has the discover transactions
    # deprecation flag enabled
    if features.has("organizations:deprecate-discover", organization, actor=request.user):
        queryset = queryset.exclude(dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE)

    queryset = filter_to_accessible_discover_queries(request, queryset)

    return queryset.annotate(
        query_type=Value(SavedQueryType.DISCOVER.value, output_field=CharField()),
        lower_name=Lower("name"),
        # Discover calls it date_created, but Explore calls it date_added
        date_added=F("date_created"),
        my_queries=Case(
            When(created_by_id=user_id, then=Value(-1)),
            default="created_by_id",
            output_field=IntegerField(),
        ),
    )


def get_explore_queryset(
    request: Request, organization: Organization, user_id: int
) -> QuerySet[ExploreSavedQuery]:
    """Returns the Explore queryset"""

    queryset: QuerySet[ExploreSavedQuery] = ExploreSavedQuery.objects.filter(
        organization=organization
    )

    if not features.has(
        "organizations:expose-migrated-discover-queries", organization, actor=request.user
    ):
        queryset = queryset.exclude(dataset=ExploreSavedQueryDataset.SEGMENT_SPANS)

    queryset = filter_to_accessible_explore_queries(request, queryset)

    return queryset.annotate(
        query_type=Value(SavedQueryType.EXPLORE.value, output_field=CharField()),
        lower_name=Lower("name"),
        my_queries=Case(
            When(created_by_id=user_id, then=Value(-1)),
            default="created_by_id",
            output_field=IntegerField(),
        ),
    )


def build_combined_queryset(
    discover_queryset: QuerySet[DiscoverSavedQuery],
    explore_queryset: QuerySet[ExploreSavedQuery],
) -> QuerySet[DiscoverSavedQuery, dict[str, Any]]:
    """Build an ordered union of the two querysets.``"""
    order_by: list[str | OrderBy] = []

    # TODO: add the actual order by logic Explore implements

    # Rows with equal sort keys need a deterministic tiebreaker.
    # id is not enough with two different types of queries, so we also use query type

    if len(order_by) == 0:
        order_by.append("lower_name")

    order_by.append("-id")
    order_by.append("query_type")

    # Both sides of a UNION must project the same columns in the same order
    columns = ["id", "query_type"]
    for column in order_by:
        if isinstance(column, OrderBy):
            name = column.expression.name
        else:
            name = column[1:] if column.startswith("-") else column
        if name not in columns:
            columns.append(name)

    return (
        discover_queryset.values(*columns)
        .union(explore_queryset.values(*columns), all=True)
        .order_by(*order_by)
    )


def serialize_results(rows: list[dict[str, Any]], user: Any) -> list[dict[str, Any]]:
    """Turn union rows (plain dicts) back into serialized model payloads."""
    discover_ids = [row["id"] for row in rows if row["query_type"] == SavedQueryType.DISCOVER]
    explore_ids = [row["id"] for row in rows if row["query_type"] == SavedQueryType.EXPLORE]

    serialized: dict[tuple[str, int], dict[str, Any]] = {}

    if discover_ids:
        discover_queries = list(
            DiscoverSavedQuery.objects.filter(id__in=discover_ids).prefetch_related("projects")
        )
        for obj, data in zip(
            discover_queries,
            serialize(discover_queries, user, serializer=DiscoverSavedQueryModelSerializer()),
        ):
            serialized[(SavedQueryType.DISCOVER, obj.id)] = {
                **data,
                "queryType": SavedQueryType.DISCOVER.value,
            }

    if explore_ids:
        explore_queries = list(
            ExploreSavedQuery.objects.filter(id__in=explore_ids).prefetch_related("projects")
        )
        for explore_obj, explore_data in zip(
            explore_queries,
            serialize(explore_queries, user, serializer=ExploreSavedQueryModelSerializer()),
        ):
            serialized[(SavedQueryType.EXPLORE, explore_obj.id)] = {
                **explore_data,
                "queryType": SavedQueryType.EXPLORE.value,
            }

    # Rebuild the order the union established. A row can be missing only if it was
    # deleted, so skip rather than raise.
    return [
        serialized[(row["query_type"], row["id"])]
        for row in rows
        if (row["query_type"], row["id"]) in serialized
    ]


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class SavedQueriesEndpoint(OrganizationEndpoint):
    """
    List a user's saved queries across both Discover and Explore as one ordered list.

    This is a GET only endpoint for fetching a combined list, use Discover and Explore's
    POST endpoints to create queries
    """

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.DATA_BROWSING
    permission_classes = (ExploreSavedQueryPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        ) and features.has(
            "organizations:discover-queries-in-all-queries", organization, actor=request.user
        )

    @extend_schema(
        operation_id="List an Organization's Explore and Discover Saved Queries",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            VisibilityParams.PER_PAGE,
            CursorQueryParam,
            # Use Explore query params and translate any Discover ones to simplify the logic
            ExploreSavedQueriesParams.QUERY,
            ExploreSavedQueriesParams.SORT,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SavedQueryListResponse",
                list[CombinedExploreSavedQueryResponse | CombinedDiscoverSavedQueryResponse],
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[CombinedExploreSavedQueryResponse | CombinedDiscoverSavedQueryResponse]]:
        """
        Retrieve a list of saved queries that are associated with the given organization.
        """
        if not request.user.is_authenticated:
            return Response(status=400)

        if not self.has_feature(organization, request):
            return self.respond(status=404)

        # Explore has prebuilt queries that are created and starred lazily on read.
        try:
            lock = locks.get(
                f"explore:sync_prebuilt_queries:{organization.id}:{request.user.id}",
                duration=10,
                name="sync_prebuilt_queries",
            )
            with lock.acquire():
                sync_prebuilt_queries(organization)
                sync_prebuilt_queries_starred(organization, request.user)
        except UnableToAcquireLock:
            pass
        except Exception as err:
            sentry_sdk.capture_exception(err)

        discover_queryset = get_discover_queryset(request, organization, request.user.id)
        explore_queryset = get_explore_queryset(request, organization, request.user.id)

        query = request.query_params.get("query")
        if query:
            for key, value in tokenize_query(query).items():
                joined = " ".join(value)
                if key in ("name", "query"):
                    discover_queryset = discover_queryset.filter(name__icontains=joined)
                    explore_queryset = explore_queryset.filter(name__icontains=joined)
                elif key == "version":
                    discover_queryset = discover_queryset.filter(version=joined)
                    explore_queryset = explore_queryset.none()
                else:
                    discover_queryset = discover_queryset.none()
                    explore_queryset = explore_queryset.none()

        combined = build_combined_queryset(
            discover_queryset,
            explore_queryset,
        )

        def data_fn(offset, limit):
            return list(combined[offset : offset + limit])

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda rows: serialize_results(rows, request.user),
            default_per_page=25,
        )
