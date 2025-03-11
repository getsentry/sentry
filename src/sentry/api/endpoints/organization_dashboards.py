from __future__ import annotations

from django.db import IntegrityError, router, transaction
from django.db.models import Case, Exists, IntegerField, OuterRef, Value, When
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, roles
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
from sentry.models.dashboard import Dashboard, DashboardFavoriteUser
from sentry.models.organization import Organization
from sentry.users.services.user.service import user_service

MAX_RETRIES = 2


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
            if features.has(
                "organizations:dashboards-table-view", organization, actor=request.user
            ):
                user_name_dict = {
                    user.id: user.name
                    for user in user_service.get_many_by_id(
                        ids=list(dashboards.values_list("created_by_id", flat=True))
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
            else:
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

        if features.has("organizations:dashboards-favourite", organization, actor=request.user):
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
        else:
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

        render_pre_built_dashboard = True
        if features.has("organizations:dashboards-favourite", organization, actor=request.user):
            if filter_by and filter_by == "onlyFavorites" or pin_by and pin_by == "favorites":
                render_pre_built_dashboard = False

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
