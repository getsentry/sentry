from __future__ import annotations

import sentry_sdk
from django.db import router, transaction
from django.db.models import Case, Count, Exists, F, IntegerField, OrderBy, OuterRef, Subquery, When
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
from sentry.explore.models import (
    ExploreSavedQuery,
    ExploreSavedQueryLastVisited,
    ExploreSavedQueryStarred,
)
from sentry.locks import locks
from sentry.search.utils import tokenize_query
from sentry.utils.locking import UnableToAcquireLock

PREBUILT_SAVED_QUERIES = [
    {
        "prebuilt_id": 1,
        "prebuilt_version": 1,
        "name": "All Transactions",
        "dataset": "spans",
        "query": [
            {
                "fields": [
                    "id",
                    "span.op",
                    "span.description",
                    "span.duration",
                    "transaction",
                    "timestamp",
                ],
                "query": "is_transaction:true",
                "mode": "samples",
                "visualize": [
                    {
                        "chartType": 0,
                        "yAxes": ["count()"],
                    },
                    {
                        "chartType": 1,
                        "yAxes": ["p75(span.duration)", "p90(span.duration)"],
                    },
                ],
                "orderby": "-timestamp",
            }
        ],
    },
    {
        "prebuilt_id": 2,
        "prebuilt_version": 1,
        "name": "DB Latency",
        "dataset": "spans",
        "query": [
            {
                "fields": [
                    "id",
                    "span.op",
                    "span.description",
                    "span.duration",
                    "transaction",
                    "timestamp",
                ],
                "query": "span.op:db*",
                "mode": "samples",
                "visualize": [
                    {
                        "chartType": 1,
                        "yAxes": ["p75(span.duration)", "p90(span.duration)"],
                    },
                ],
                "orderby": "-timestamp",
            }
        ],
    },
    {
        "prebuilt_id": 3,
        "prebuilt_version": 1,
        "name": "Slow HTTP Requests",
        "dataset": "spans",
        "query": [
            {
                "fields": [
                    "id",
                    "span.op",
                    "span.description",
                    "span.duration",
                    "transaction",
                    "timestamp",
                ],
                "query": "span.op:http.client",
                "mode": "samples",
                "visualize": [
                    {
                        "chartType": 1,
                        "yAxes": ["p75(span.duration)", "p90(span.duration)"],
                    },
                ],
                "orderby": "-timestamp",
            }
        ],
    },
    {
        "prebuilt_id": 4,
        "prebuilt_version": 2,
        "name": "Worst Pageloads",
        "dataset": "spans",
        "query": [
            {
                "fields": [
                    "id",
                    "span.op",
                    "span.description",
                    "span.duration",
                    "transaction",
                    "timestamp",
                    "measurements.lcp",
                ],
                "query": "span.op:pageload measurements.lcp:>0ms",
                "mode": "samples",
                "visualize": [
                    {
                        "chartType": 0,
                        "yAxes": ["count()"],
                    },
                    {
                        "chartType": 1,
                        "yAxes": ["p75(measurements.lcp)", "p90(measurements.lcp)"],
                    },
                ],
                "orderby": "-measurements.lcp",
            }
        ],
    },
]


def sync_prebuilt_queries(organization):
    """
    Queries the database to check if prebuilt queries have an ExploreSavedQuery record and
    creates them if they don't, updates them if they're outdated, or deletes them if they
    should no longer exist. We determine if a prebuilt query should be updated by comparing the
    prebuilt_version column.
    """
    with transaction.atomic(router.db_for_write(ExploreSavedQuery)):
        saved_prebuilt_queries = ExploreSavedQuery.objects.filter(
            organization=organization,
            prebuilt_id__isnull=False,
        )

        saved_prebuilt_query_ids = set(saved_prebuilt_queries.values_list("prebuilt_id", flat=True))

        # Create prebuilt queries if they don't exist, or update them if they are outdated
        queries_to_create = []
        queries_to_update = []
        for prebuilt_query in PREBUILT_SAVED_QUERIES:
            # Ensure the prebuilt query is valid also provides mapping for some fields such as the dataset string `spans` into the int `0`
            serializer = ExploreSavedQuerySerializer(
                data=prebuilt_query,
                context={
                    "params": {"project_id": None},
                    "organization": organization,
                    "user": None,
                },
            )
            if serializer.is_valid():
                data = serializer.validated_data
                params = {
                    "organization": organization,
                    "name": data["name"],
                    "query": data["query"],
                    "dataset": data["dataset"],
                    "created_by_id": None,
                    "prebuilt_id": prebuilt_query["prebuilt_id"],
                    "prebuilt_version": prebuilt_query["prebuilt_version"],
                }
            else:
                continue
            if prebuilt_query["prebuilt_id"] in saved_prebuilt_query_ids:
                saved_prebuilt_query = saved_prebuilt_queries.get(
                    prebuilt_id=prebuilt_query["prebuilt_id"]  # type: ignore[misc]
                )
                if prebuilt_query["prebuilt_version"] > saved_prebuilt_query.prebuilt_version:
                    queries_to_update.append(
                        ExploreSavedQuery(
                            id=saved_prebuilt_query.id,
                            **params,
                        )
                    )
            else:
                queries_to_create.append(ExploreSavedQuery(**params))
        if queries_to_create:
            ExploreSavedQuery.objects.bulk_create(queries_to_create)
        if queries_to_update:
            ExploreSavedQuery.objects.bulk_update(
                queries_to_update,
                ["name", "query", "dataset", "created_by_id", "prebuilt_id", "prebuilt_version"],
            )

        # Delete old prebuilt queries if they should no longer exist
        queries_to_delete = []
        for saved_prebuilt_query_id in saved_prebuilt_query_ids:
            if saved_prebuilt_query_id not in [
                prebuilt_query["prebuilt_id"] for prebuilt_query in PREBUILT_SAVED_QUERIES
            ]:
                queries_to_delete.append(saved_prebuilt_query_id)
        if queries_to_delete:
            ExploreSavedQuery.objects.filter(
                organization=organization, prebuilt_id__in=queries_to_delete
            ).delete()


def sync_prebuilt_queries_starred(organization, user_id):
    """
    Queries the database to check if prebuilt queries have an ExploreSavedQueryStarred record for the user_id, and creates them if they don't.
    This ensures that prebuilt queries are starred by default for all users.
    """
    with transaction.atomic(router.db_for_write(ExploreSavedQueryStarred)):
        prebuilt_query_ids_without_starred_status = (
            ExploreSavedQuery.objects.filter(
                organization=organization,
                prebuilt_id__isnull=False,
            )
            .exclude(
                id__in=ExploreSavedQueryStarred.objects.filter(
                    organization=organization,
                    user_id=user_id,
                ).values_list("explore_saved_query_id", flat=True)
            )
            .order_by("prebuilt_id")  # Ensures prebuilt queries are starred in the correct order
            .values_list("id", flat=True)
        )
        for prebuilt_query_id in prebuilt_query_ids_without_starred_status:
            # Not using bulk_create because we need to handle position with insert_starred_query
            ExploreSavedQueryStarred.objects.insert_starred_query(
                organization, user_id, ExploreSavedQuery.objects.get(id=prebuilt_query_id)
            )


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
            "organizations:visibility-explore-view", organization, actor=request.user
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

        if not request.user.is_authenticated:
            return Response(status=400)

        if not self.has_feature(organization, request):
            return self.respond(status=404)

        try:
            lock = locks.get(
                f"explore:sync_prebuilt_queries:{organization.id}:{request.user.id}",
                duration=10,
                name="sync_prebuilt_queries",
            )
            with lock.acquire():
                # Adds prebuilt queries to the database if they don't exist.
                # Updates them if they are outdated.
                # Deletes old prebuilt queries from the database if they should no longer exist.
                # Stars prebuilt queries for the user if it is the first time they are being fetched by the user.
                sync_prebuilt_queries(organization)
                sync_prebuilt_queries_starred(organization, request.user.id)
        except UnableToAcquireLock:
            # Another process is already syncing the prebuilt queries. We can skip syncing this time.
            pass
        except Exception as err:
            sentry_sdk.capture_exception(err)

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

        last_visited_query = Subquery(
            ExploreSavedQueryLastVisited.objects.filter(
                organization=organization,
                user_id=request.user.id,
                explore_saved_query_id=OuterRef("id"),
            ).values("last_visited")[:1]
        )
        queryset = queryset.annotate(user_last_visited=last_visited_query)

        order_by: list[OrderBy | Case | str] = []

        sort_by_list = request.query_params.getlist("sortBy")
        if sort_by_list and len(sort_by_list) > 0:
            for sort_by in sort_by_list:
                if sort_by.startswith("-"):
                    sort_by, desc = sort_by[1:], True
                else:
                    desc = False

                if sort_by == "name":
                    order_by.append("-lower_name" if desc else "lower_name")

                elif sort_by == "dateAdded":
                    order_by.append("-date_added" if desc else "date_added")

                elif sort_by == "dateUpdated":
                    order_by.append("-date_updated" if desc else "date_updated")

                elif sort_by == "mostPopular":
                    order_by.append("visits" if desc else "-visits")

                elif sort_by == "recentlyViewed":
                    order_by.append(
                        F("user_last_visited").asc(nulls_last=True)
                        if desc
                        else F("user_last_visited").desc(nulls_last=True)
                    )

                elif sort_by == "myqueries":
                    order_by.append(
                        Case(
                            When(created_by_id=request.user.id, then=-1),
                            default="created_by_id",
                            output_field=IntegerField(),
                        ),
                    )

                elif sort_by == "mostStarred":
                    queryset = queryset.annotate(starred_count=Count("exploresavedquerystarred"))
                    order_by.append("-starred_count")

                elif sort_by == "starred":
                    queryset = queryset.annotate(
                        is_starred=Exists(
                            ExploreSavedQueryStarred.objects.filter(
                                explore_saved_query_id=OuterRef("id"),
                                user_id=request.user.id,
                                starred=True,
                            )
                        )
                    )
                    order_by.append("-is_starred")

        if len(order_by) == 0:
            order_by.append("lower_name")

        #  Finally we always at least secondarily sort by dateAdded
        if "dateAdded" not in sort_by_list and "-dateAdded" not in sort_by_list:
            order_by.append("-date_added")

        exclude = request.query_params.get("exclude")
        if exclude == "shared":
            queryset = queryset.filter(created_by_id=request.user.id)
        elif exclude == "owned":
            queryset = queryset.exclude(created_by_id=request.user.id)

        starred = request.query_params.get("starred")

        if starred == "1":
            queryset = (
                queryset.filter(
                    id__in=ExploreSavedQueryStarred.objects.filter(
                        organization=organization, user_id=request.user.id, starred=True
                    ).values_list("explore_saved_query_id", flat=True)
                )
                .annotate(
                    position=Subquery(
                        ExploreSavedQueryStarred.objects.filter(
                            explore_saved_query_id=OuterRef("id"),
                            user_id=request.user.id,
                            starred=True,
                        ).values("position")[:1]
                    )
                )
                .order_by("position")
            )
            order_by = ["position", "-date_added"]

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
        if not request.user.is_authenticated:
            return Response(status=400)

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
                    organization, request.user.id, model, starred=True
                )
        except Exception as err:
            sentry_sdk.capture_exception(err)

        return Response(serialize(model), status=201)
