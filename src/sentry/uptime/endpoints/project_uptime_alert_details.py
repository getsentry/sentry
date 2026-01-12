from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, UptimeParams
from sentry.models.project import Project
from sentry.uptime.endpoints.bases import ProjectUptimeAlertEndpoint
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from sentry.uptime.endpoints.validators import UptimeMonitorValidator
from sentry.uptime.models import get_audit_log_data
from sentry.uptime.subscriptions.subscriptions import delete_uptime_detector
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.models import Detector


@region_silo_endpoint
class ProjectUptimeAlertDetailsEndpoint(ProjectUptimeAlertEndpoint):
    owner = ApiOwner.CRONS

    # TODO(davidenwang): Flip these to public after EA
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="Retrieve an Uptime Alert Rule for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            UptimeParams.UPTIME_ALERT_ID,
        ],
        responses={
            200: UptimeDetectorSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        project: Project,
        uptime_detector: Detector,
    ) -> Response:
        return self.respond(
            serialize(uptime_detector, request.user, serializer=UptimeDetectorSerializer())
        )

    @extend_schema(
        operation_id="Update an Uptime Monitor for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            UptimeParams.UPTIME_ALERT_ID,
        ],
        request=UptimeMonitorValidator,
        responses={
            200: UptimeDetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self,
        request: Request,
        project: Project,
        uptime_detector: Detector,
    ) -> Response:
        """
        Update an uptime monitor.
        """
        assertions_enabled = features.has(
            "organizations:uptime-runtime-assertions", project.organization, actor=request.user
        )
        validator = UptimeMonitorValidator(
            assertions_enabled,
            data=request.data,
            partial=True,
            instance=uptime_detector,
            context={
                "organization": project.organization,
                "project": project,
                "access": request.access,
                "request": request,
            },
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        return self.respond(
            serialize(validator.save(), request.user, serializer=UptimeDetectorSerializer())
        )

    @extend_schema(
        operation_id="Delete an Uptime Monitor for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            UptimeParams.UPTIME_ALERT_ID,
        ],
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self,
        request: Request,
        project: Project,
        uptime_detector: Detector,
    ) -> Response:
        """
        Delete an uptime monitor.
        """
        audit_log_data = get_audit_log_data(uptime_detector)
        delete_uptime_detector(uptime_detector)
        create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=uptime_detector.id,
            event=audit_log.get_event_id("UPTIME_MONITOR_REMOVE"),
            data=audit_log_data,
        )

        return self.respond(status=202)
