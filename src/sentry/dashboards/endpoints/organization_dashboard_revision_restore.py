from __future__ import annotations

from typing import Any

from django.db import IntegrityError, router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import DashboardDetailsSerializer
from sentry.dashboards.endpoints.organization_dashboard_details import (
    OrganizationDashboardBase,
    _take_dashboard_snapshot,
)
from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.models.organization import Organization


def _prepare_restore_data(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Strip widget and query IDs from snapshot so all widgets/queries are recreated fresh on restore."""
    restore_data = dict(snapshot)
    if "widgets" in restore_data:
        widgets = []
        for widget in restore_data["widgets"]:
            widget_copy = dict(widget)
            widget_copy.pop("id", None)
            if "queries" in widget_copy:
                widget_copy["queries"] = [
                    {k: v for k, v in q.items() if k != "id"} for q in widget_copy["queries"]
                ]
            widgets.append(widget_copy)
        restore_data["widgets"] = widgets
    return restore_data


@cell_silo_endpoint
class OrganizationDashboardRevisionRestoreEndpoint(OrganizationDashboardBase):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DASHBOARDS

    def post(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard | dict[str, Any],
        revision_id: int | str,
    ) -> Response:
        """
        Restore a dashboard to the state captured in the given revision.
        """
        if not isinstance(dashboard, Dashboard):
            return Response(status=404)

        self.check_object_permissions(request, dashboard)

        try:
            revision = DashboardRevision.objects.get(id=revision_id, dashboard=dashboard)
        except (DashboardRevision.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        if revision.snapshot_schema_version != DashboardRevision.SNAPSHOT_SCHEMA_VERSION:
            return Response(
                {"detail": "Cannot restore revision: snapshot schema version is not supported."},
                status=400,
            )

        # Snapshot current state before overwriting — must be outside the transaction
        # because the serializer makes hybrid-cloud RPC calls.
        snapshot = _take_dashboard_snapshot(dashboard, request.user)

        restore_data = _prepare_restore_data(revision.snapshot)

        projects = self.get_projects(request, organization)
        serializer = DashboardDetailsSerializer(
            data=restore_data,
            instance=dashboard,
            context={
                "organization": organization,
                "request": request,
                "projects": projects,
                # allow_joinleave grants project access without team membership.
                "validation_projects": projects
                or self.get_projects(request, organization, include_all_accessible=True),
                "environment": self.request.GET.getlist("environment"),
                "allow_legacy_widget_heights": True,
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            with transaction.atomic(router.db_for_write(DashboardRevision)):
                if snapshot is not None:
                    DashboardRevision.create_for_dashboard(
                        dashboard, request.user, snapshot, source="pre-restore"
                    )
                serializer.save()
        except IntegrityError:
            return Response({"detail": "Dashboard with that title already exists."}, status=409)

        updated_dashboard = serializer.instance
        assert updated_dashboard is not None
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=updated_dashboard.id,
            event=audit_log.get_event_id("DASHBOARD_RESTORE"),
            data=updated_dashboard.get_audit_log_data(),
        )

        return self.respond(serialize(updated_dashboard, request.user), status=200)
