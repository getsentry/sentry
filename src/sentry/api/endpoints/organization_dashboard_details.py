import sentry_sdk
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_dashboards import OrganizationDashboardsPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import DashboardDetailsSerializer
from sentry.models.dashboard import Dashboard, DashboardTombstone

EDIT_FEATURE = "organizations:dashboards-edit"
READ_FEATURE = "organizations:dashboards-basic"


class OrganizationDashboardBase(OrganizationEndpoint):
    permission_classes = (OrganizationDashboardsPermission,)

    def convert_args(self, request: Request, organization_slug, dashboard_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug)

        try:
            kwargs["dashboard"] = self._get_dashboard(request, kwargs["organization"], dashboard_id)
        except (Dashboard.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        return (args, kwargs)

    def _get_dashboard(self, request: Request, organization, dashboard_id):
        prebuilt = Dashboard.get_prebuilt(dashboard_id)
        sentry_sdk.set_tag("dashboard.is_prebuilt", prebuilt is not None)
        if prebuilt:
            return prebuilt
        return Dashboard.objects.get(id=dashboard_id, organization_id=organization.id)


class OrganizationDashboardDetailsEndpoint(OrganizationDashboardBase):
    def get(self, request: Request, organization, dashboard) -> Response:
        """
        Retrieve an Organization's Dashboard
        ````````````````````````````````````

        Return details on an individual organization's dashboard.

        :pparam Organization organization: the organization the dashboard belongs to.
        :pparam Dashboard dashboard: the dashboard object
        :auth: required
        """
        if not features.has(READ_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if isinstance(dashboard, dict):
            return self.respond(dashboard)

        return self.respond(serialize(dashboard, request.user))

    def delete(self, request: Request, organization, dashboard) -> Response:
        """
        Delete an Organization's Dashboard
        ```````````````````````````````````

        Delete an individual organization's dashboard, or tombstone
        a pre-built dashboard which effectively deletes it.

        :pparam Organization organization: the organization the dashboard belongs to.
        :pparam Dashboard dashboard: the dashboard object
        :auth: required
        """
        if not features.has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        num_dashboards = Dashboard.objects.filter(organization=organization).count()
        num_tombstones = DashboardTombstone.objects.filter(organization=organization).count()

        if isinstance(dashboard, dict):
            if num_dashboards > 0:
                DashboardTombstone.objects.get_or_create(
                    organization=organization, slug=dashboard["id"]
                )
            else:
                return self.respond({"Cannot delete last Dashboard."}, status=409)
        elif (num_dashboards > 1) or (num_tombstones == 0):
            dashboard.delete()
        else:
            return self.respond({"Cannot delete last Dashboard."}, status=409)

        return self.respond(status=204)

    def put(self, request: Request, organization, dashboard) -> Response:
        """
        Edit an Organization's Dashboard
        ```````````````````````````````````

        Edit an individual organization's dashboard as well as
        bulk edits on widgets (i.e. rearranging widget order).

        :pparam Organization organization: the organization the dashboard belongs to.
        :pparam Dashboard dashboard: the old dashboard object
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


class OrganizationDashboardVisitEndpoint(OrganizationDashboardBase):
    def post(self, request: Request, organization, dashboard) -> Response:
        """
        Update last_visited and increment visits counter
        """
        if not features.has(EDIT_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if isinstance(dashboard, dict):
            return Response(status=204)

        dashboard.visits = F("visits") + 1
        dashboard.last_visited = timezone.now()
        dashboard.save(update_fields=["visits", "last_visited"])

        return Response(status=204)
