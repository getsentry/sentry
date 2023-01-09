from __future__ import annotations

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.monitor import MonitorEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.monitor import MonitorSerializerResponse
from sentry.api.validators import MonitorValidator
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS, MONITOR_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import Monitor, MonitorStatus, ScheduledDeletion


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class MonitorDetailsEndpoint(MonitorEndpoint):
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
    def get(
        self, request: Request, project, monitor, organization_slug: str | None = None
    ) -> Response:
        """
        Retrieves details for a monitor.
        """
        if organization_slug:
            if project.organization.slug != organization_slug:
                return self.respond_invalid()

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
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def put(
        self, request: Request, project, monitor, organization_slug: str | None = None
    ) -> Response:
        """
        Update a monitor.
        """
        if organization_slug:
            if project.organization.slug != organization_slug:
                return self.respond_invalid()

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
            context={"organization": project.organization, "access": request.access},
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.save()

        params = {}
        if "name" in result:
            params["name"] = result["name"]
        if "status" in result:
            if result["status"] == MonitorStatus.ACTIVE:
                if monitor.status not in (MonitorStatus.OK, MonitorStatus.ERROR):
                    params["status"] = MonitorStatus.ACTIVE
            else:
                params["status"] = result["status"]
        if "config" in result:
            params["config"] = result["config"]
        if "project" in result and result["project"].id != monitor.project_id:
            params["project_id"] = result["project"].id

        if params:
            monitor.update(**params)
            self.create_audit_entry(
                request=request,
                organization=project.organization,
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
    def delete(
        self, request: Request, project, monitor, organization_slug: str | None = None
    ) -> Response:
        """
        Delete a monitor.
        """

        if organization_slug:
            if project.organization.slug != organization_slug:
                return self.respond_invalid()

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
