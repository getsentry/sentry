from __future__ import annotations

from django.db.models import Case, IntegerField, When
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.discoversavedquery import (
    DiscoverSavedQueryModelSerializer,
    DiscoverSavedQueryResponse,
)
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.discover_saved_query_examples import DiscoverExamples
from sentry.apidocs.parameters import (
    CursorQueryParam,
    DiscoverSavedQueriesParams,
    GlobalParams,
    VisibilityParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.search.utils import tokenize_query


@extend_schema(tags=["Discover"])
@region_silo_endpoint
class DiscoverSavedQueriesEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.PERFORMANCE
    permission_classes = (DiscoverSavedQueryPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:discover", organization, actor=request.user
        ) or features.has("organizations:discover-query", organization, actor=request.user)

    @extend_schema(
        operation_id="List an Organization's Discover Saved Queries",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            VisibilityParams.PER_PAGE,
            CursorQueryParam,
            DiscoverSavedQueriesParams.QUERY,
            DiscoverSavedQueriesParams.SORT,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "DiscoverSavedQueryListResponse", list[DiscoverSavedQueryResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DiscoverExamples.DISCOVER_SAVED_QUERIES_QUERY_RESPONSE,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Retrieve a list of saved queries that are associated with the given organization.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        queryset = (
            DiscoverSavedQuery.objects.filter(organization=organization)
            .prefetch_related("projects")
            .extra(select={"lower_name": "lower(name)"})
        ).exclude(is_homepage=True)
        query = request.query_params.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "name" or key == "query":
                    queryset = queryset.filter(name__icontains=" ".join(value))
                elif key == "version":
                    queryset = queryset.filter(version=" ".join(value))
                else:
                    queryset = queryset.none()

        sort_by = request.query_params.get("sortBy")
        if sort_by and sort_by.startswith("-"):
            sort_by, desc = sort_by[1:], True
        else:
            desc = False

        if sort_by == "name":
            order_by: list[Case | str] = [
                "-lower_name" if desc else "lower_name",
                "-date_created",
            ]

        elif sort_by == "dateCreated":
            order_by = ["-date_created" if desc else "date_created"]

        elif sort_by == "dateUpdated":
            order_by = ["-date_updated" if desc else "date_updated"]

        elif sort_by == "mostPopular":
            order_by = [
                "visits" if desc else "-visits",
                "-date_updated",
            ]

        elif sort_by == "recentlyViewed":
            order_by = ["last_visited" if desc else "-last_visited"]

        elif sort_by == "myqueries":
            order_by = [
                Case(
                    When(created_by_id=request.user.id, then=-1),
                    default="created_by_id",
                    output_field=IntegerField(),
                ),
                "-date_created",
            ]

        else:
            order_by = ["lower_name"]

        queryset = queryset.order_by(*order_by)

        # Old discover expects all queries and uses this parameter.
        if request.query_params.get("all") == "1":
            saved_queries = list(queryset.all())
            return Response(serialize(saved_queries), status=200)

        def data_fn(offset, limit):
            return list(queryset[offset : offset + limit])

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    @extend_schema(
        operation_id="Create a New Saved Query",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DiscoverSavedQuerySerializer,
        responses={
            201: DiscoverSavedQueryModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DiscoverExamples.DISCOVER_SAVED_QUERY_POST_RESPONSE,
    )
    def post(self, request: Request, organization) -> Response:
        """
        Create a new saved query for the given organization.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        try:
            params = self.get_filter_params(
                request, organization, project_ids=request.data.get("projects")
            )
        except NoProjects:
            raise ParseError(detail="No Projects found, join a Team")

        serializer = DiscoverSavedQuerySerializer(
            data=request.data,
            context={"params": params, "organization": organization, "user": request.user},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        user_selected_dataset = (
            features.has(
                "organizations:performance-discover-dataset-selector",
                organization,
                actor=request.user,
            )
            and data["query_dataset"] != DiscoverSavedQueryTypes.DISCOVER
        )

        model = DiscoverSavedQuery.objects.create(
            organization=organization,
            name=data["name"],
            query=data["query"],
            version=data["version"],
            dataset=data["query_dataset"],
            dataset_source=(
                DatasetSourcesTypes.USER.value
                if user_selected_dataset
                else DatasetSourcesTypes.UNKNOWN.value
            ),
            created_by_id=request.user.id if request.user.is_authenticated else None,
        )

        model.set_projects(data["project_ids"])

        return Response(serialize(model), status=201)
