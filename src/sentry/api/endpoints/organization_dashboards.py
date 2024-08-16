from __future__ import annotations

import re

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

MAX_RETRIES = 10
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
            for project in obj.projects.all():
                if not request.access.has_project_access(project):
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
            sources=[prebuilt, dashboards],
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
            pass

        duplicate = request.data.get("duplicate", False)
        if not duplicate or retry >= MAX_RETRIES:
            return Response("Dashboard title already taken", status=409)

        title = request.data["title"]
        match = re.match(DUPLICATE_TITLE_PATTERN, title)
        if match:
            partial_title = match.group(1)
            copy_counter = match.group(2)
            if copy_counter:
                request.data["title"] = f"{partial_title} copy {int(copy_counter) + 1}"
            else:
                request.data["title"] = f"{partial_title} copy 1"
        else:
            request.data["title"] = f"{title} copy"

        return self.post(request, organization, retry=retry + 1)
