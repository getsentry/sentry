from __future__ import annotations

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS, MONITOR_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import ScheduledDeletion
from sentry.monitors.models import Monitor, MonitorStatus
from sentry.monitors.serializers import MonitorSerializerResponse
from sentry.monitors.validators import MonitorValidator

from .base import MonitorEndpoint


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorDetailsEndpoint(MonitorEndpoint):
    public = {"GET", "PUT", "DELETE"}

    @extend_schema(
        operation_id="Retrieve a monitor",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
        ],
        responses={
            200: inline_sentry_response_serializer("Monitor", MonitorSerializerResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def get(self, request: Request, organization, project, monitor) -> Response:
        """
        Retrieves details for a monitor.
        """
        return self.respond(serialize(monitor, request.user))

    @extend_schema(
        operation_id="Update a monitor",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
        ],
        request=MonitorValidator,
        responses={
            200: inline_sentry_response_serializer("Monitor", MonitorSerializerResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def put(self, request: Request, organization, project, monitor) -> Response:
        """
        Update a monitor.
        """
        validator = MonitorValidator(
            data=request.data,
            partial=True,
            instance={
                "name": monitor.name,
                "status": monitor.status,
                "type": monitor.type,
                "config": monitor.config,
                "project": project,
            },
            context={"organization": organization, "access": request.access},
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.save()

        params = {}
        if "name" in result:
            params["name"] = result["name"]
        if "slug" in result:
            params["slug"] = result["slug"]
        if "status" in result:
            if result["status"] == MonitorStatus.ACTIVE:
                if monitor.status not in (MonitorStatus.OK, MonitorStatus.ERROR):
                    params["status"] = MonitorStatus.ACTIVE
            else:
                params["status"] = result["status"]
        if "config" in result:
            params["config"] = result["config"]
        if "project" in result and result["project"].id != monitor.project_id:
            raise ParameterValidationError("existing monitors may not be moved between projects")

        if params:
            monitor.update(**params)
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=monitor.id,
                event=audit_log.get_event_id("MONITOR_EDIT"),
                data=monitor.get_audit_log_data(),
            )

        return self.respond(serialize(monitor, request.user))

    @extend_schema(
        operation_id="Delete a monitor",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
        ],
        request=MonitorValidator,
        responses={
            202: RESPONSE_ACCEPTED,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def delete(self, request: Request, organization, project, monitor) -> Response:
        """
        Delete a monitor.
        """
        with transaction.atomic():
            affected = (
                Monitor.objects.filter(id=monitor.id)
                .exclude(
                    status__in=[MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS]
                )
                .update(status=MonitorStatus.PENDING_DELETION)
            )
            if not affected:
                return self.respond(status=404)

            schedule = ScheduledDeletion.schedule(monitor, days=0, actor=request.user)
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=monitor.id,
                event=audit_log.get_event_id("MONITOR_REMOVE"),
                data=monitor.get_audit_log_data(),
                transaction_id=schedule.guid,
            )

        return self.respond(status=202)
