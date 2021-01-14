from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers.rest_framework import DashboardWidgetSerializer
from sentry.api.endpoints.organization_dashboards import OrganizationDashboardsPermission


class OrganizationDashboardWidgetDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDashboardsPermission,)

    def post(self, request, organization):
        """
        Validate a Widget
        `````````````````

        Ensure that a dashboard widget contains a valid queries,
        and has a high chance of success when the dashboard is
        saved.
        """
        serializer = DashboardWidgetSerializer(
            data=request.data, context={"organization": organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        return Response({}, status=200)
