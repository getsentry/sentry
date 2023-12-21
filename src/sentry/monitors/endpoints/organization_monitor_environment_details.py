from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
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
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.constants import ObjectStatus
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.monitors.endpoints.base import MonitorEndpoint
from sentry.monitors.models import MonitorEnvironment, MonitorStatus
from sentry.monitors.serializers import MonitorSerializer


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorEnvironmentDetailsEndpoint(MonitorEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Update a Monitor Environment",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
            MonitorParams.ENVIRONMENT,
        ],
        responses={
            200: MonitorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, organization, project, monitor, monitor_environment
    ) -> Response:
        """
        Update a monitor environment.
        """
        # Only support muting/unmuting monitor environments
        is_muted = request.data.get("isMuted")
        if type(is_muted) is bool:
            monitor_environment.update(is_muted=is_muted)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=monitor_environment.id,
            event=audit_log.get_event_id("MONITOR_ENVIRONMENT_EDIT"),
            data=monitor_environment.get_audit_log_data(),
        )

        return self.respond(serialize(monitor, request.user))

    @extend_schema(
        operation_id="Delete a Monitor Environments",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
            MonitorParams.ENVIRONMENT,
        ],
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self, request: Request, organization, project, monitor, monitor_environment
    ) -> Response:
        """
        Delete a monitor environment.
        """
        active_monitor_environment = (
            MonitorEnvironment.objects.filter(id=monitor_environment.id)
            .exclude(
                monitor__status__in=[
                    ObjectStatus.PENDING_DELETION,
                    ObjectStatus.DELETION_IN_PROGRESS,
                ]
            )
            .exclude(
                status__in=[
                    MonitorStatus.PENDING_DELETION,
                    MonitorStatus.DELETION_IN_PROGRESS,
                ]
            )
            .first()
        )

        if not active_monitor_environment or not active_monitor_environment.update(
            status=MonitorStatus.PENDING_DELETION
        ):
            return self.respond(status=404)

        schedule = RegionScheduledDeletion.schedule(
            active_monitor_environment, days=0, actor=request.user
        )
        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=active_monitor_environment.id,
            event=audit_log.get_event_id("MONITOR_ENVIRONMENT_EDIT"),
            data=active_monitor_environment.get_audit_log_data(),
            transaction_id=schedule.guid,
        )

        return self.respond(status=202)
