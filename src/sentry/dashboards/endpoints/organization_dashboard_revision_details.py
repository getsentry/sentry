from __future__ import annotations

from typing import Any

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers.models.dashboard import DashboardDetailsModelSerializer
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.dashboard_examples import DashboardExamples
from sentry.apidocs.parameters import DashboardParams, GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.dashboards.endpoints.organization_dashboard_details import (
    OrganizationDashboardBase,
)
from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.models.organization import Organization


@extend_schema(tags=["Dashboards"])
@cell_silo_endpoint
class OrganizationDashboardRevisionDetailsEndpoint(OrganizationDashboardBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DASHBOARDS

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        dashboard_id: str | int,
        revision_id: str | int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, dashboard_id, *args, **kwargs
        )
        dashboard = kwargs.get("dashboard")
        if not isinstance(dashboard, Dashboard):
            raise ResourceDoesNotExist

        try:
            kwargs["revision"] = DashboardRevision.objects.get(
                id=revision_id,
                dashboard=dashboard,
            )
        except (DashboardRevision.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        return args, kwargs

    @extend_schema(
        operation_id="getOrganizationDashboardRevision",
        summary="Retrieve a Custom Dashboard Revision",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DashboardParams.DASHBOARD_ID,
            DashboardParams.REVISION_ID,
        ],
        request=None,
        responses={
            200: DashboardDetailsModelSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            422: OpenApiResponse(description="Unprocessable Entity"),
        },
        examples=DashboardExamples.DASHBOARD_GET_RESPONSE,
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard,
        revision: DashboardRevision,
    ) -> Response[dict[str, Any]] | Response[DetailResponse]:
        """
        Return a custom dashboard as it was saved in one of its revisions, in the same shape
        as retrieving the dashboard. Use it to preview a revision before restoring it. Returns
        422 if the revision was saved in an older format that can't be previewed.
        """
        if revision.snapshot_schema_version != DashboardRevision.SNAPSHOT_SCHEMA_VERSION:
            return Response(
                {"detail": "This revision requires migration before it can be previewed."},
                status=422,
            )

        return self.respond(revision.snapshot)
