from __future__ import annotations

import sentry_sdk
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
from sentry.api.serializers.models.exploresavedquery import (
    ExploreSavedQueryModelSerializer,
    ExploreSavedQueryResponse,
)
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.explore_saved_query_examples import ExploreExamples
from sentry.apidocs.parameters import (
    CursorQueryParam,
    ExploreSavedQueriesParams,
    GlobalParams,
    VisibilityParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.explore.endpoints.bases import ExploreSavedQueryPermission
from sentry.explore.endpoints.serializers import ExploreSavedQuerySerializer
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryStarred
from sentry.search.utils import tokenize_query


@extend_schema(tags=["Discover"])
@region_silo_endpoint
class ExploreSavedQueriesEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.PERFORMANCE
    permission_classes = (ExploreSavedQueryPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        )

    @extend_schema(
        operation_id="List an Organization's Explore Saved Queries",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            VisibilityParams.PER_PAGE,
            CursorQueryParam,
            ExploreSavedQueriesParams.QUERY,
            ExploreSavedQueriesParams.SORT,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ExploreSavedQueryListResponse", list[ExploreSavedQueryResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ExploreExamples.EXPLORE_SAVED_QUERIES_QUERY_RESPONSE,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Retrieve a list of saved queries that are associated with the given organization.
        """

        if not self.has_feature(organization, request):
            return self.respond(status=404)

        queryset = (
            ExploreSavedQuery.objects.filter(organization=organization)
            .prefetch_related("projects")
            .extra(select={"lower_name": "lower(name)"})
        )
        query = request.query_params.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "name" or key == "query":
                    queryset = queryset.filter(name__icontains=" ".join(value))
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
                "-date_added",
            ]

        elif sort_by == "dateAdded":
            order_by = ["-date_added" if desc else "date_added"]

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
                "-date_added",
            ]

        else:
            order_by = ["lower_name"]

        exclude = request.query_params.get("exclude")
        if exclude == "shared":
            queryset = queryset.filter(created_by_id=request.user.id)
        elif exclude == "owned":
            queryset = queryset.exclude(created_by_id=request.user.id)

        starred_queries = request.query_params.get("starred")

        if starred_queries == "1":
            queryset = queryset.filter(
                id__in=ExploreSavedQueryStarred.objects.filter(
                    organization=organization, user_id=request.user.id
                ).values_list("explore_saved_query_id", flat=True)
            )

        queryset = queryset.order_by(*order_by)

        def data_fn(offset, limit):
            return list(queryset[offset : offset + limit])

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    @extend_schema(
        operation_id="Create a New Trace Explorer Saved Query",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=ExploreSavedQuerySerializer,
        responses={
            201: ExploreSavedQueryModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ExploreExamples.EXPLORE_SAVED_QUERY_POST_RESPONSE,
    )
    def post(self, request: Request, organization) -> Response:
        """
        Create a new trace explorersaved query for the given organization.
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        try:
            params = self.get_filter_params(
                request, organization, project_ids=request.data.get("projects")
            )
        except NoProjects:
            raise ParseError(detail="No Projects found, join a Team")

        serializer = ExploreSavedQuerySerializer(
            data=request.data,
            context={"params": params, "organization": organization, "user": request.user},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        model = ExploreSavedQuery.objects.create(
            organization=organization,
            name=data["name"],
            query=data["query"],
            dataset=data["dataset"],
            created_by_id=request.user.id if request.user.is_authenticated else None,
        )

        model.set_projects(data["project_ids"])

        try:
            if "starred" in request.data and request.data["starred"]:
                ExploreSavedQueryStarred.objects.insert_starred_query(
                    organization, request.user.id, model
                )
        except Exception as err:
            sentry_sdk.capture_exception(err)

        return Response(serialize(model), status=201)
