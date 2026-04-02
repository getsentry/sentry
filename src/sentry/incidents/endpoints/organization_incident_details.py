from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.incident import DetailedIncidentSerializer
from sentry.incidents.endpoints.serializers.utils import get_object_id_from_fake_id
from sentry.incidents.endpoints.serializers.workflow_engine_incident import (
    WorkflowEngineDetailedIncidentSerializer,
)
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.incident import Incident, IncidentStatus, IncidentStatusMethod
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.utils.ids import to_valid_int_id
from sentry.workflow_engine.models import IncidentGroupOpenPeriod
from sentry.workflow_engine.utils.legacy_metric_tracking import track_alert_endpoint_execution


class IncidentSerializer(serializers.Serializer):
    status = serializers.IntegerField()
    comment = serializers.CharField(required=False, allow_null=True)

    def validate_status(self, value):
        try:
            value = IncidentStatus(value)
        except Exception:
            raise serializers.ValidationError(
                f"Invalid value for status. Valid values: {[e.value for e in IncidentStatus]}"
            )
        return value


@cell_silo_endpoint
class OrganizationIncidentDetailsEndpoint(IncidentEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (IncidentPermission,)

    def convert_args(
        self,
        request: Request,
        incident_identifier: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        int_id = to_valid_int_id("incident_identifier", incident_identifier, raise_404=True)

        # We call OrganizationEndpoint.convert_args directly instead of super()
        # (IncidentEndpoint.convert_args) because IncidentEndpoint unconditionally queries
        # the legacy Incident model, which would 404 before we can check the feature flag
        # and redirect to workflow engine data.  The legacy Incident lookup at the bottom
        # of this method replicates IncidentEndpoint's behaviour for the flag-off path.
        # TODO: once PUT is migrated to the workflow engine path, the flag-off branch can
        # be removed and this override eliminated in favour of a WE-aware IncidentEndpoint.
        args, kwargs = OrganizationEndpoint.convert_args(self, request, *args, **kwargs)
        organization = kwargs["organization"]

        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        if request.method == "GET" and features.has(
            "organizations:workflow-engine-rule-serializers", organization
        ):
            gop: GroupOpenPeriod | None = None

            # Try the association table first (dual-written data).
            try:
                igop = IncidentGroupOpenPeriod.objects.select_related(
                    "group_open_period__project",
                    "group_open_period__group",
                ).get(
                    incident_identifier=int_id,
                    group_open_period__project__organization=organization,
                )
                gop = igop.group_open_period
            except IncidentGroupOpenPeriod.DoesNotExist:
                pass

            # Fall back to manufactured ID (single-written data).
            if gop is None:
                gop_id = get_object_id_from_fake_id(int_id)
                if gop_id > 0:
                    try:
                        gop = GroupOpenPeriod.objects.select_related("project", "group").get(
                            id=gop_id, project__organization=organization
                        )
                    except GroupOpenPeriod.DoesNotExist:
                        pass

            if gop is None:
                raise ResourceDoesNotExist

            if not request.access.has_project_access(gop.project):
                raise PermissionDenied

            kwargs["incident"] = gop
            return args, kwargs

        # Legacy path (flag off): replicate IncidentEndpoint.convert_args lookup.
        try:
            incident = kwargs["incident"] = Incident.objects.get(
                organization=organization, identifier=int_id
            )
        except Incident.DoesNotExist:
            raise ResourceDoesNotExist

        if not any(p for p in incident.projects.all() if request.access.has_project_access(p)):
            raise PermissionDenied

        return args, kwargs

    @track_alert_endpoint_execution("GET", "sentry-api-0-organization-incident-details")
    def get(
        self,
        request: Request,
        organization: Organization,
        incident: Incident | GroupOpenPeriod,
    ) -> Response:
        """
        Fetch an Incident.
        ``````````````````
        :auth: required
        """
        if isinstance(incident, GroupOpenPeriod):
            expand = request.GET.getlist("expand", [])
            return Response(
                serialize(
                    incident, request.user, WorkflowEngineDetailedIncidentSerializer(expand=expand)
                )
            )

        return Response(serialize(incident, request.user, DetailedIncidentSerializer()))

    @track_alert_endpoint_execution("PUT", "sentry-api-0-organization-incident-details")
    def put(self, request: Request, organization: Organization, incident) -> Response:
        serializer = IncidentSerializer(data=request.data)
        if serializer.is_valid():
            result = serializer.validated_data
            if result["status"] == IncidentStatus.CLOSED:
                incident = update_incident_status(
                    incident=incident,
                    status=result["status"],
                    status_method=IncidentStatusMethod.MANUAL,
                )
                return Response(
                    serialize(incident, request.user, DetailedIncidentSerializer()), status=200
                )
            else:
                return Response("Status cannot be changed.", status=400)
        return Response(serializer.errors, status=400)
