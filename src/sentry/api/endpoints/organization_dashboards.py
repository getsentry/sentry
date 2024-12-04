from __future__ import annotations

from django.db import IntegrityError, router, transaction
from django.db.models import Case, IntegerField, When
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
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
from sentry.models.dashboard import Dashboard
from sentry.models.organization import Organization

MAX_RETRIES = 2
DUPLICATE_TITLE_PATTERN = r"(.*) copy(?:$|\s(\d+))"


class OrganizationDashboardsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }

    def has_object_permission(self, request: Request, view, obj):
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, Dashboard):
            if features.has(
                "organizations:dashboards-edit-access", obj.organization, actor=request.user
            ):
                # allow for Managers and Owners
                if request.access.has_scope("org:write"):
                    return True

                # check if user is restricted from editing dashboard
                if hasattr(obj, "permissions"):
                    return obj.permissions.has_edit_permissions(request.user.id)

                # if no permissions are assigned, it is considered accessible to all users
                return True

            else:
                # 1. Dashboard contains certain projects
                if obj.projects.exists():
                    return request.access.has_projects_access(obj.projects.all())

                # 2. Dashboard covers all projects or all my projects

                # allow when Open Membership
                if obj.organization.flags.allow_joinleave:
                    return True

                # allow for Managers and Owners
                if request.access.has_scope("org:write"):
                    return True

                # allow for creator
                if request.user.id == obj.created_by_id:
                    return True

                return False

        return True


@extend_schema(tags=["Dashboards"])
@region_silo_endpoint
class OrganizationDashboardsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.PERFORMANCE
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
    def get(self, request: Request, organization) -> Response:
        """
        Retrieve a list of custom dashboards that are associated with the given organization.
        """
        if not features.has("organizations:dashboards-basic", organization, actor=request.user):
            return Response(status=404)

        if features.has("organizations:dashboards-favourite", organization, actor=request.user):
            filter_by = request.query_params.get("filter")
            if filter_by == "onlyFavorites":
                dashboards = Dashboard.objects.filter(
                    organization_id=organization.id, dashboardfavoriteuser__user_id=request.user.id
                )
            elif filter_by == "excludeFavorites":
                dashboards = Dashboard.objects.exclude(
                    organization_id=organization.id, dashboardfavoriteuser__user_id=request.user.id
                )
            else:
                dashboards = Dashboard.objects.filter(organization_id=organization.id)
        else:
            dashboards = Dashboard.objects.filter(organization_id=organization.id)

        query = request.GET.get("query")
        if query:
            dashboards = dashboards.filter(title__icontains=query)
        prebuilt = Dashboard.get_prebuilt_list(organization, request.user, query)

        sort_by = request.query_params.get("sort")
        if sort_by and sort_by.startswith("-"):
            sort_by, desc = sort_by[1:], True
        else:
            desc = False

        order_by: list[Case | str]
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
            order_by = ["last_visited" if desc else "-last_visited"]

        elif sort_by == "mydashboards":
            order_by = [
                Case(
                    When(created_by_id=request.user.id, then=-1),
                    default="created_by_id",
                    output_field=IntegerField(),
                ),
                "-date_added",
            ]

        elif sort_by == "myDashboardsAndRecentlyViewed":
            order_by = [
                Case(When(created_by_id=request.user.id, then=-1), default=1),
                "-last_visited",
            ]

        else:
            order_by = ["title"]

        dashboards = dashboards.order_by(*order_by)

        list_serializer = DashboardListSerializer()

        def handle_results(results):
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

            serialized.extend(serialize(dashboards, request.user, serializer=list_serializer))
            return serialized

        return self.paginate(
            request=request,
            sources=(
                [dashboards]
                if features.has(
                    "organizations:dashboards-favourite", organization, actor=request.user
                )
                and filter_by
                and filter_by == "onlyFavorites"
                else [prebuilt, dashboards]
            ),
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
    def post(self, request: Request, organization, retry=0) -> Response:
        """
        Create a new dashboard for the given Organization
        """
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

        try:
            with transaction.atomic(router.db_for_write(Dashboard)):
                dashboard = serializer.save()
            return Response(serialize(dashboard, request.user), status=201)
        except IntegrityError:
            duplicate = request.data.get("duplicate", False)

            if not duplicate or retry >= MAX_RETRIES:
                return Response("Dashboard title already taken", status=409)

            request.data["title"] = Dashboard.incremental_title(organization, request.data["title"])

            return self.post(request, organization, retry=retry + 1)
