from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry.api.bases.dashboard import OrganizationDashboardEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import DashboardDetailsSerializer
from sentry.models.dashboard import DashboardTombstone
from sentry.api.endpoints.organization_dashboards import OrganizationDashboardsPermission
from sentry import features

EDIT_FEATURE = "organizations:dashboards-edit"
READ_FEATURE = "organizations:dashboards-basic"


class OrganizationDashboardDetailsEndpoint(OrganizationDashboardEndpoint):
    permission_classes = (OrganizationDashboardsPermission,)

    def get(self, request, organization, dashboard):
        """
        Retrieve an Organization's Dashboard
        ````````````````````````````````````

        Return details on an individual organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :auth: required
        """
        if not features.has(READ_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if isinstance(dashboard, dict):
            return self.respond(dashboard)

        return self.respond(serialize(dashboard, request.user))

    def delete(self, request, organization, dashboard):
        """
        Delete an Organization's Dashboard
        ```````````````````````````````````

        Delete an individual organization's dashboard, or tombstone
        a pre-built dashboard which effectively deletes it.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :auth: required
        """
        if not features.has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if isinstance(dashboard, dict):
            DashboardTombstone.objects.get_or_create(
                organization=organization, slug=dashboard["id"]
            )
        else:
            dashboard.delete()

        return self.respond(status=204)

    def put(self, request, organization, dashboard):
        """
        Edit an Organization's Dashboard
        ```````````````````````````````````

        Edit an individual organization's dashboard as well as
        bulk edits on widgets (i.e. rearranging widget order).

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :param array widgets: the array of widgets (consisting of a widget id and the order)
                            to be updated.
        :auth: required
        """
        if not features.has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        tombstone = None
        if isinstance(dashboard, dict):
            tombstone = dashboard["id"]
            dashboard = None

        serializer = DashboardDetailsSerializer(
            data=request.data,
            instance=dashboard,
            context={
                "organization": organization,
                "request": request,
                "projects": self.get_projects(request, organization),
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        try:
            with transaction.atomic():
                serializer.save()
                if tombstone:
                    DashboardTombstone.objects.get_or_create(
                        organization=organization, slug=tombstone
                    )
        except IntegrityError:
            return self.respond({"Dashboard with that title already exists."}, status=409)

        return self.respond(serialize(serializer.instance, request.user), status=200)
