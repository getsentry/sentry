from __future__ import annotations

import logging
from typing import Any

from django.db import IntegrityError, router, transaction
from django.db.models import F
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.dashboard import DashboardDetailsModelSerializer
from sentry.api.serializers.rest_framework import DashboardDetailsSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.dashboard_examples import DashboardExamples
from sentry.apidocs.parameters import DashboardParams, GlobalParams
from sentry.dashboards.endpoints.organization_dashboards import OrganizationDashboardsPermission
from sentry.models.dashboard import (
    Dashboard,
    DashboardRevision,
)
from sentry.models.organization import Organization

EDIT_FEATURE = "organizations:dashboards-edit"
READ_FEATURE = "organizations:dashboards-basic"
REVISIONS_FEATURE = "organizations:dashboards-revisions"

logger = logging.getLogger(__name__)


def _take_dashboard_snapshot(
    dashboard: Dashboard,
    user: Any,
) -> dict[str, Any] | None:
    """
    Serialize the current dashboard state as a snapshot, or return None if
    serialization fails.

    Must be called outside any transaction.atomic block because the serializer
    makes hybrid-cloud RPC calls (user_service.serialize_many) that cannot run
    inside a transaction.
    """
    try:
        return serialize(dashboard, user)
    except Exception:
        # Snapshot failures must not block the dashboard save. Log and skip.
        logger.exception(
            "Failed to serialize dashboard snapshot; proceeding without creating revision",
            extra={"dashboard_id": dashboard.id},
        )
        return None


class OrganizationDashboardBase(OrganizationEndpoint):
    owner = ApiOwner.DASHBOARDS
    permission_classes = (OrganizationDashboardsPermission,)

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        dashboard_id: str | int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        try:
            kwargs["dashboard"] = Dashboard.objects.get(
                id=dashboard_id, organization_id=kwargs["organization"].id
            )
        except (Dashboard.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        return (args, kwargs)


@extend_schema(tags=["Dashboards"])
@cell_silo_endpoint
class OrganizationDashboardDetailsEndpoint(OrganizationDashboardBase):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve an Organization's Custom Dashboard",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, DashboardParams.DASHBOARD_ID],
        responses={
            200: DashboardDetailsModelSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DashboardExamples.DASHBOARD_GET_RESPONSE,
    )
    def get(self, request: Request, organization: Organization, dashboard: Dashboard) -> Response:
        """
        Return details about an organization's custom dashboard.
        """
        if not features.has(READ_FEATURE, organization, actor=request.user):
            return Response(status=404)

        return self.respond(serialize(dashboard, request.user))

    @extend_schema(
        operation_id="Delete an Organization's Custom Dashboard",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, DashboardParams.DASHBOARD_ID],
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self, request: Request, organization: Organization, dashboard: Dashboard
    ) -> Response:
        """
        Delete an organization's custom dashboard.
        """
        if not features.has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        self.check_object_permissions(request, dashboard)

        if dashboard.prebuilt_id is not None:
            return self.respond({"detail": "Cannot delete prebuilt Dashboards."}, status=409)

        dashboard.delete()

        return self.respond(status=204)

    @extend_schema(
        operation_id="Edit an Organization's Custom Dashboard",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, DashboardParams.DASHBOARD_ID],
        request=DashboardDetailsSerializer,
        responses={
            200: DashboardDetailsModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DashboardExamples.DASHBOARD_PUT_RESPONSE,
    )
    def put(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard,
    ) -> Response:
        """
        Edit an organization's custom dashboard as well as any bulk
        edits on widgets that may have been made. (For example, widgets
        that have been rearranged, updated queries and fields, specific
        display types, and so on.)
        """
        if not features.has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        self.check_object_permissions(request, dashboard)

        is_prebuilt = dashboard.prebuilt_id is not None

        serializer = DashboardDetailsSerializer(
            data=request.data,
            instance=dashboard,
            context={
                "organization": organization,
                "request": request,
                "projects": self.get_projects(request, organization),
                "environment": self.request.GET.getlist("environment"),
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        if is_prebuilt:
            if "widgets" in serializer.validated_data:
                return self.respond(
                    {"detail": "Cannot edit widgets on prebuilt Dashboards."}, status=409
                )
            if (
                "title" in serializer.validated_data
                and serializer.validated_data["title"] != dashboard.title
            ):
                return self.respond(
                    {"detail": "Cannot change the title of prebuilt Dashboards."}, status=409
                )

        snapshot = None
        if features.has(REVISIONS_FEATURE, organization, actor=request.user):
            snapshot = _take_dashboard_snapshot(dashboard, request.user)

        revision_source = request.data.get("revisionSource", "edit")
        if revision_source not in ("edit", "edit-with-agent"):
            revision_source = "edit"

        try:
            with transaction.atomic(router.db_for_write(Dashboard)):
                if snapshot is not None:
                    DashboardRevision.create_for_dashboard(
                        dashboard, request.user, snapshot, source=revision_source
                    )
                serializer.save()
        except IntegrityError:
            return self.respond({"detail": "Dashboard with that title already exists."}, status=409)

        return self.respond(serialize(serializer.instance, request.user), status=200)


@cell_silo_endpoint
class OrganizationDashboardVisitEndpoint(OrganizationDashboardBase):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, organization: Organization, dashboard: Dashboard) -> Response:
        """
        Update last_visited and increment visits counter
        """
        if not features.has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        dashboard.visits = F("visits") + 1
        dashboard.last_visited = timezone.now()
        dashboard.save(update_fields=["visits", "last_visited"])

        return Response(status=204)


@cell_silo_endpoint
class OrganizationDashboardFavoriteEndpoint(OrganizationDashboardBase):
    """
    Endpoint for managing the favorite status of dashboards for users
    """

    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }

    def put(self, request: Request, organization: Organization, dashboard: Dashboard) -> Response:
        """
        Toggle favorite status for current user by adding or removing
        current user from dashboard favorites
        """
        if not features.has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if not request.user.is_authenticated:
            return Response(status=401)

        is_favorited = request.data.get("isFavorited")

        current_favorites = set(dashboard.favorited_by)

        if is_favorited and request.user.id not in current_favorites:
            current_favorites.add(request.user.id)
        elif not is_favorited and request.user.id in current_favorites:
            current_favorites.remove(request.user.id)
        else:
            return Response(status=204)

        dashboard.favorited_by = current_favorites

        return Response(status=204)
