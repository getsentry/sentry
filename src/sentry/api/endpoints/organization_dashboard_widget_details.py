from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.endpoints.organization_dashboards import OrganizationDashboardsPermission
from sentry.api.serializers.rest_framework import DashboardWidgetSerializer


@region_silo_endpoint
class OrganizationDashboardWidgetDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDashboardsPermission,)

    def post(self, request: Request, organization) -> Response:
        """
        Validate a Widget
        `````````````````

        Ensure that a dashboard widget contains a valid queries,
        and has a high chance of success when the dashboard is
        saved.
        """
        if not features.has("organizations:dashboards-edit", organization, actor=request.user):
            return Response(status=404)

        serializer = DashboardWidgetSerializer(
            data=request.data,
            context={
                "organization": organization,
                "projects": self.get_projects(request, organization),
                "displayType": request.data.get("displayType"),
            },
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        return Response({}, status=200)
