from __future__ import annotations

from enum import IntEnum
from typing import Any, TypedDict

import sentry_sdk
from django.db import IntegrityError, router, transaction
from django.db.models import (
    Case,
    Count,
    Exists,
    F,
    IntegerField,
    OrderBy,
    OuterRef,
    Subquery,
    Value,
    When,
)
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import features, options, quotas, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.dashboard import (
    DashboardDetailsModelSerializer,
    DashboardListResponse,
    DashboardListSerializer,
)
from sentry.api.serializers.rest_framework import DashboardSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.dashboard_examples import DashboardExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.superuser import is_active_superuser
from sentry.db.models.fields.text import CharField
from sentry.locks import locks
from sentry.models.dashboard import Dashboard, DashboardFavoriteUser, DashboardLastVisited
from sentry.models.organization import Organization
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.users.services.user.service import user_service
from sentry.utils.locking import UnableToAcquireLock

MAX_RETRIES = 2


# Do not delete or modify existing entries. These enums are required to match ids in the frontend.
class PrebuiltDashboardId(IntEnum):
    FRONTEND_SESSION_HEALTH = 1
    BACKEND_QUERIES = 2
    BACKEND_QUERIES_SUMMARY = 3
    WEB_VITALS = 6
    WEB_VITALS_SUMMARY = 7
    MOBILE_VITALS = 8
    MOBILE_VITALS_APP_STARTS = 9
    MOBILE_VITALS_SCREEN_LOADS = 10
    MOBILE_VITALS_SCREEN_RENDERING = 11


class PrebuiltDashboard(TypedDict):
    prebuilt_id: PrebuiltDashboardId
    title: str


# Prebuilt dashboards store minimal fields in the database. The actual dashboard and widget settings are
# coded in the frontend and we rely on matching prebuilt_id to populate the dashboard and widget display.
# Prebuilt dashboard database records are purely for tracking things like starred status, last viewed, etc.
#
# Note A: This is stored differently from the `default-overview` prebuilt dashboard, which we should
# deprecate once this feature is released.
# Note B: Consider storing all dashboard and widget data in the database instead of relying on matching
# prebuilt_id on the frontend, if there are issues.
# Note C: These titles should match the configs in the `PREBUILT_DASHBOARDS` constant in the frontend so that the results returned by the API match the titles in the frontend.
PREBUILT_DASHBOARDS: list[PrebuiltDashboard] = [
    {
        "prebuilt_id": PrebuiltDashboardId.FRONTEND_SESSION_HEALTH,
        "title": "Frontend Session Health",
    },
    {
        "prebuilt_id": PrebuiltDashboardId.BACKEND_QUERIES,
        "title": "Queries",
    },
    {
        "prebuilt_id": PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY,
        "title": "Query Details",
    },
    {
        "prebuilt_id": PrebuiltDashboardId.WEB_VITALS,
        "title": "Web Vitals",
    },
    {
        "prebuilt_id": PrebuiltDashboardId.MOBILE_VITALS,
        "title": "Mobile Vitals",
    },
    {
        "prebuilt_id": PrebuiltDashboardId.MOBILE_VITALS_APP_STARTS,
        "title": "App Starts",
    },
    {
        "prebuilt_id": PrebuiltDashboardId.MOBILE_VITALS_SCREEN_LOADS,
        "title": "Screen Loads",
    },
    {
        "prebuilt_id": PrebuiltDashboardId.MOBILE_VITALS_SCREEN_RENDERING,
        "title": "Screen Rendering",
    },
]


def sync_prebuilt_dashboards(organization: Organization) -> None:
    """
    Queries the database to check if prebuilt dashboards have a Dashboard record and
    creates them if they don't, updates titles if they've changed, or deletes them
    if they should no longer exist.
    """

    with transaction.atomic(router.db_for_write(Dashboard)):
        enabled_prebuilt_dashboard_ids = options.get("dashboards.prebuilt-dashboard-ids")
        enabled_prebuilt_dashboards = [
            dashboard
            for dashboard in PREBUILT_DASHBOARDS
            if dashboard["prebuilt_id"] in enabled_prebuilt_dashboard_ids
        ]

        saved_prebuilt_dashboards = Dashboard.objects.filter(
            organization=organization,
            prebuilt_id__isnull=False,
        )

        saved_prebuilt_dashboard_map = {d.prebuilt_id: d for d in saved_prebuilt_dashboards}

        # Create prebuilt dashboards if they don't exist, or update titles if changed
        dashboards_to_update: list[Dashboard] = []
        for prebuilt_dashboard in enabled_prebuilt_dashboards:
            prebuilt_id: PrebuiltDashboardId = prebuilt_dashboard["prebuilt_id"]

            if prebuilt_id not in saved_prebuilt_dashboard_map:
                # Create new dashboard
                Dashboard.objects.create(
                    organization=organization,
                    title=prebuilt_dashboard["title"],
                    created_by_id=None,
                    prebuilt_id=prebuilt_id,
                )
            elif saved_prebuilt_dashboard_map[prebuilt_id].title != prebuilt_dashboard["title"]:
                # Update title if changed
                saved_prebuilt_dashboard_map[prebuilt_id].title = prebuilt_dashboard["title"]
                dashboards_to_update.append(saved_prebuilt_dashboard_map[prebuilt_id])

        if dashboards_to_update:
            Dashboard.objects.bulk_update(dashboards_to_update, ["title"])

        # Delete old prebuilt dashboards if they should no longer exist
        prebuilt_ids = [d["prebuilt_id"] for d in enabled_prebuilt_dashboards]
        Dashboard.objects.filter(
            organization=organization,
            prebuilt_id__isnull=False,
        ).exclude(prebuilt_id__in=prebuilt_ids).delete()


class OrganizationDashboardsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }

    def has_object_permission(
        self,
        request: Request,
        view: APIView,
        obj: Organization | RpcOrganization | RpcUserOrganizationContext | Dashboard,
    ) -> bool:
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, Dashboard):
            is_superuser = is_active_superuser(request)
            # allow strictly for Owners and superusers, this allows them to delete dashboards
            # of users that no longer have access to the organization
            if is_superuser or request.access.has_role_in_organization(
                role=roles.get_top_dog().id, organization=obj.organization, user_id=request.user.id
            ):
                return True

            # check if user is restricted from editing dashboard
            if hasattr(obj, "permissions"):
                return obj.permissions.has_edit_permissions(request.user.id)

            # if no permissions are assigned, it is considered accessible to all users
            return True

        return True


@extend_schema(tags=["Dashboards"])
@region_silo_endpoint
class OrganizationDashboardsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.DASHBOARDS
    permission_classes = (OrganizationDashboardsPermission,)

    @extend_schema(
        operation_id="List an Organization's Custom Dashboards",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, VisibilityParams.PER_PAGE, CursorQueryParam],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "DashboardListResponse", list[DashboardListResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DashboardExamples.DASHBOARDS_QUERY_RESPONSE,
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve a list of custom dashboards that are associated with the given organization.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        if not features.has("organizations:dashboards-basic", organization, actor=request.user):
            return Response(status=404)

        if features.has(
            "organizations:dashboards-prebuilt-insights-dashboards",
            organization,
            actor=request.user,
        ):
            # Sync prebuilt dashboards to the database
            try:
                lock = locks.get(
                    f"dashboards:sync_prebuilt_dashboards:{organization.id}",
                    duration=10,
                    name="sync_prebuilt_dashboards",
                )
                with lock.acquire():
                    # Adds prebuilt dashboards to the database if they don't exist.
                    # Deletes old prebuilt dashboards from the database if they should no longer exist.
                    sync_prebuilt_dashboards(organization)
            except UnableToAcquireLock:
                # Another process is already syncing the prebuilt dashboards. We can skip syncing this time.
                pass
            except Exception as err:
                sentry_sdk.capture_exception(err)

        filter_by = request.query_params.get("filter")
        if filter_by == "onlyFavorites":
            dashboards = Dashboard.objects.filter(
                organization_id=organization.id, dashboardfavoriteuser__user_id=request.user.id
            )
        elif filter_by == "excludeFavorites":
            dashboards = Dashboard.objects.exclude(
                organization_id=organization.id, dashboardfavoriteuser__user_id=request.user.id
            )
        elif filter_by == "owned":
            dashboards = Dashboard.objects.filter(
                created_by_id=request.user.id, organization_id=organization.id
            )
        elif filter_by == "shared":
            dashboards = Dashboard.objects.filter(organization_id=organization.id).exclude(
                created_by_id=request.user.id
            )
        else:
            dashboards = Dashboard.objects.filter(organization_id=organization.id)

        query = request.GET.get("query")
        prebuilt_ids = request.GET.getlist("prebuiltId")

        should_filter_by_prebuilt_ids = (
            features.has(
                "organizations:dashboards-prebuilt-insights-dashboards",
                organization,
                actor=request.user,
            )
            and prebuilt_ids
            and len(prebuilt_ids) > 0
        )

        if query:
            dashboards = dashboards.filter(title__icontains=query)
        if should_filter_by_prebuilt_ids:
            dashboards = dashboards.filter(prebuilt_id__in=prebuilt_ids)

        prebuilt = Dashboard.get_prebuilt_list(organization, request.user, query)

        sort_by = request.query_params.get("sort")
        if sort_by and sort_by.startswith("-"):
            sort_by, desc = sort_by[1:], True
        else:
            desc = False

        order_by: list[Case | str | OrderBy]
        if sort_by == "title":
            order_by = [
                "-title" if desc else "title",
                "-date_added",
            ]

        elif sort_by == "dateCreated":
            order_by = ["-date_added" if desc else "date_added"]

        elif sort_by == "mostPopular":
            order_by = [
                "visits" if desc else "-visits",
                "-date_added",
            ]

        elif sort_by == "recentlyViewed":
            if features.has(
                "organizations:dashboards-starred-reordering", organization, actor=request.user
            ):
                dashboards = dashboards.annotate(
                    user_last_visited=Subquery(
                        DashboardLastVisited.objects.filter(
                            dashboard=OuterRef("pk"),
                            member__user_id=request.user.id,
                            member__organization=organization,
                        ).values("last_visited")
                    )
                )
                order_by = [
                    (
                        F("user_last_visited").asc(nulls_last=True)
                        if desc
                        else F("user_last_visited").desc(nulls_last=True)
                    ),
                    "-date_added",
                ]
            else:
                order_by = ["last_visited" if desc else "-last_visited"]

        elif sort_by == "mydashboards":
            user_name_dict = {
                user.id: user.name
                for user in user_service.get_many_by_id(
                    ids=list(
                        id
                        for id in dashboards.values_list("created_by_id", flat=True).filter(
                            created_by_id__isnull=False
                        )
                        if id is not None
                    )
                )
            }
            dashboards = dashboards.annotate(
                user_name=Case(
                    *[
                        When(created_by_id=user_id, then=Value(user_name))
                        for user_id, user_name in user_name_dict.items()
                    ],
                    default=Value(""),
                    output_field=CharField(),
                )
            )
            order_by = [
                Case(
                    When(created_by_id=request.user.id, then=-1),
                    default=1,
                    output_field=IntegerField(),
                ),
                "-user_name" if desc else "user_name",
                "-date_added",
            ]

        elif sort_by == "myDashboardsAndRecentlyViewed":
            order_by = [
                Case(When(created_by_id=request.user.id, then=-1), default=1),
                "-last_visited",
            ]

        elif sort_by == "mostFavorited" and features.has(
            "organizations:dashboards-starred-reordering", organization, actor=request.user
        ):
            dashboards = dashboards.annotate(
                favorites_count=Count("dashboardfavoriteuser", distinct=True)
            )
            order_by = [
                "favorites_count" if desc else "-favorites_count",
                "-date_added",
            ]

        else:
            order_by = ["title"]

        pin_by = request.query_params.get("pin")
        if pin_by == "favorites":
            favorited_by_subquery = DashboardFavoriteUser.objects.filter(
                dashboard=OuterRef("pk"), user_id=request.user.id
            )

            order_by_favorites = [
                Case(
                    When(Exists(favorited_by_subquery), then=-1),
                    default=1,
                    output_field=IntegerField(),
                )
            ]
            dashboards = dashboards.order_by(*order_by_favorites, *order_by)
        else:
            dashboards = dashboards.order_by(*order_by)

        list_serializer = DashboardListSerializer()

        def handle_results(results: list[Dashboard | dict[str, Any]]) -> list[dict[str, Any]]:
            serialized = []
            dashboards = []
            for item in results:
                if isinstance(item, dict):
                    cloned = item.copy()
                    widgets = cloned.pop("widgets", [])
                    cloned["widgetDisplay"] = [w["displayType"] for w in widgets]
                    cloned["widgetPreview"] = [
                        {"displayType": w["displayType"], "layout": None} for w in widgets
                    ]
                    serialized.append(cloned)
                else:
                    dashboards.append(item)

            serialized.extend(
                serialize(
                    dashboards,
                    request.user,
                    serializer=list_serializer,
                    context={"organization": organization},
                )
            )
            return serialized

        render_pre_built_dashboard = True
        if filter_by and filter_by in {"onlyFavorites", "owned"} or should_filter_by_prebuilt_ids:
            render_pre_built_dashboard = False
        elif pin_by and pin_by == "favorites":
            # Only hide prebuilt dashboard when pinning favorites if there are actual dashboards to show
            # This allows the prebuilt dashboard to appear when users have no dashboards yet
            render_pre_built_dashboard = not dashboards.exists()

        return self.paginate(
            request=request,
            sources=([prebuilt, dashboards] if render_pre_built_dashboard else [dashboards]),
            paginator_cls=ChainPaginator,
            on_results=handle_results,
        )

    @extend_schema(
        operation_id="Create a New Dashboard for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DashboardSerializer,
        responses={
            201: DashboardDetailsModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
        examples=DashboardExamples.DASHBOARD_POST_RESPONSE,
    )
    def post(self, request: Request, organization: Organization, retry: int = 0) -> Response:
        """
        Create a new dashboard for the given Organization
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        if not features.has("organizations:dashboards-edit", organization, actor=request.user):
            return Response(status=404)

        serializer = DashboardSerializer(
            data=request.data,
            context={
                "organization": organization,
                "request": request,
                "projects": self.get_projects(request, organization),
                "environment": self.request.GET.getlist("environment"),
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # We need to acquire a lock so that a burst of concurrent create requests doesn't read
        # stale count data and bypass the dashboard limit for an org.
        dashboard_create_lock = locks.get(
            f"dashboard:create:{organization.id}",
            duration=5,
            name="dashboard_create",
        )

        try:
            with (
                dashboard_create_lock.acquire(),
                transaction.atomic(router.db_for_write(Dashboard)),
            ):

                dashboard_count = Dashboard.objects.filter(
                    organization=organization, prebuilt_id=None
                ).count()
                dashboard_limit = quotas.backend.get_dashboard_limit(organization.id)
                if dashboard_limit >= 0 and dashboard_count >= dashboard_limit:
                    return Response(
                        f"You may not exceed {dashboard_limit} dashboards on your current plan.",
                        status=400,
                    )

                dashboard = serializer.save()

                if features.has(
                    "organizations:dashboards-starred-reordering",
                    organization,
                    actor=request.user,
                ):
                    if serializer.validated_data.get("is_favorited"):
                        try:
                            DashboardFavoriteUser.objects.insert_favorite_dashboard(
                                organization=organization,
                                user_id=request.user.id,
                                dashboard=dashboard,
                            )
                        except Exception as e:
                            sentry_sdk.capture_exception(e)

            return Response(serialize(dashboard, request.user), status=201)
        except IntegrityError:
            duplicate = request.data.get("duplicate", False)

            if not duplicate or retry >= MAX_RETRIES:
                return Response("Dashboard title already taken", status=409)

            request.data["title"] = Dashboard.incremental_title(organization, request.data["title"])

            return self.post(request, organization, retry=retry + 1)
        except UnableToAcquireLock:
            return Response("Unable to create dashboard, please try again", status=503)
