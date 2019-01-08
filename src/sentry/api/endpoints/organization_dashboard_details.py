from __future__ import absolute_import

from django.http import Http404
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import (
    OrganizationEndpoint
)
from sentry.api.bases.dashboard import DashboardSerializer
from sentry.api.serializers import serialize
from sentry.models import Dashboard, ObjectStatus


class OrganizationDashboardDetailsEndpoint(OrganizationEndpoint):

    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization, dashboard_id):
        """
        Retrieve an Organization's Dashboard
        ````````````````````````````````````

        Return details on an individual organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :auth: required
        """
        try:
            dashboard = Dashboard.objects.get(
                id=dashboard_id,
                organization_id=organization.id,
            )
        except Dashboard.DoesNotExist:
            raise Http404

        return self.respond(serialize(dashboard, request.user))

    def delete(self, request, organization, dashboard_id):
        try:
            dashboard = Dashboard.objects.get(
                id=dashboard_id,
                organization=organization,
            )
        except Dashboard.DoesNotExist:
            raise Http404

        Dashboard.objects.filter(
            id=dashboard.id,
            status=ObjectStatus.VISIBLE,
        ).update(status=ObjectStatus.PENDING_DELETION)

        return self.respond(status=204)

    def put(self, request, organization, dashboard_id):
        try:
            Dashboard.objects.get(
                id=dashboard_id,
                organization_id=organization.id,
            )
        except Dashboard.DoesNotExist:
            raise Http404

        serializer = DashboardSerializer(data=request.DATA, context={'organization': organization})

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        dashboard, changed_data = serializer.save()

        return self.respond(serialize(dashboard, request.user, DashboardSerializer()))
