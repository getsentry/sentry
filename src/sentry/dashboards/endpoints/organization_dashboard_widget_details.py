from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers.rest_framework import DashboardWidgetSerializer
from sentry.api.serializers.rest_framework.dashboard import DashboardWidgetValidationResponse
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.dashboards.endpoints.organization_dashboards import OrganizationDashboardsPermission
from sentry.models.organization import Organization


@extend_schema(tags=["Dashboards"])
@cell_silo_endpoint
class OrganizationDashboardWidgetDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DASHBOARDS
    permission_classes = (OrganizationDashboardsPermission,)

    @extend_schema(
        operation_id="validateOrganizationDashboardWidget",
        summary="Validate a Custom Dashboard Widget",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
        ],
        request=DashboardWidgetSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "DashboardWidgetValidationResponse", DashboardWidgetValidationResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization
    ) -> Response[DashboardWidgetValidationResponse] | Response[dict[str, Any]]:
        """
        Check that a widget definition is valid before saving it to a dashboard, without saving
        anything. Returns 200 with warnings that don't block saving, such as queries that can't
        use on-demand metrics. Returns 400 with the validation errors, plus the same
        `warnings`, if the widget is invalid.
        """
        projects = self.get_projects(request, organization)
        serializer = DashboardWidgetSerializer(
            data=request.data,
            context={
                "organization": organization,
                "projects": projects,
                # allow_joinleave grants project access without team membership.
                "validation_projects": projects
                or self.get_projects(request, organization, include_all_accessible=True),
                "displayType": request.data.get("displayType"),
                "environment": request.GET.getlist("environment"),
                "request": request,
            },
        )
        if not serializer.is_valid():
            # need to include warnings even if there are errors
            errors: dict[str, Any] = {**serializer.errors, "warnings": serializer.query_warnings}
            return Response(errors, status=400)
        return Response({"warnings": serializer.query_warnings}, status=200)
