from __future__ import annotations

from typing import Any

from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.dashboard import (
    DashboardDetailsModelSerializer,
    DashboardDetailsResponse,
)
from sentry.api.serializers.rest_framework import DashboardDetailsSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_CONFLICT,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.dashboard_examples import DashboardExamples
from sentry.apidocs.parameters import DashboardParams, GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
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


@extend_schema(tags=["Dashboards"])
@cell_silo_endpoint
class OrganizationDashboardRevisionRestoreEndpoint(OrganizationDashboardBase):
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }
    # A restore records a new pre-restore revision and an audit log entry every time.
    idempotent_methods = frozenset()
    owner = ApiOwner.DASHBOARDS

    @extend_schema(
        operation_id="restoreOrganizationDashboardRevision",
        summary="Restore a Custom Dashboard Revision",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DashboardParams.DASHBOARD_ID,
            DashboardParams.REVISION_ID,
        ],
        request=None,
        responses={
            200: DashboardDetailsModelSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            409: RESPONSE_CONFLICT,
        },
        examples=DashboardExamples.DASHBOARD_REVISION_RESTORE_RESPONSE,
    )
    def post(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard | dict[str, Any],
        revision_id: int | str,
    ) -> (
        Response[DashboardDetailsResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
        | Response[None]
    ):
        """
        Restore an organization's custom dashboard to the state saved in one of its revisions,
        replacing its title, widgets and saved settings such as filters, and return the restored
        dashboard.

        The dashboard's current state is first recorded as a new revision with the source
        `pre-restore`, so a restore can itself be undone. Restoring again records another
        revision, so retrying a restore is not idempotent. The requesting user needs edit
        access to the dashboard. Returns 400 if the revision can no longer be restored, for
        example because its snapshot format is unsupported or it fails validation, and 409 if
        another dashboard already uses the revision's title.
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

        projects = self.get_projects(
            request,
            organization,
            project_ids=set(restore_data.get("projects", [])),
        )
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
            return Response(as_validation_errors(serializer), status=400)

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

        body: DashboardDetailsResponse = serialize(updated_dashboard, request.user)
        return self.respond(body, status=200)
