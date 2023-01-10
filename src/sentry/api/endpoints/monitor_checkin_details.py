from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.monitor import MonitorEndpoint, ProjectMonitorPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.monitorcheckin import MonitorCheckInSerializerResponse
from sentry.api.validators import MonitorCheckInValidator
from sentry.apidocs.constants import (
    RESPONSE_ALREADY_REPORTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS, MONITOR_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorStatus,
    Project,
    ProjectKey,
    ProjectStatus,
)
from sentry.utils.sdk import bind_organization_context, configure_scope


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class MonitorCheckInDetailsEndpoint(Endpoint):
    authentication_classes = MonitorEndpoint.authentication_classes + (DSNAuthentication,)
    permission_classes = (ProjectMonitorPermission,)
    public = {"GET", "PUT"}

    # TODO(dcramer): this code needs shared with other endpoints as its security focused
    # TODO(dcramer): this doesnt handle is_global roles
    def convert_args(
        self,
        request: Request,
        monitor_id,
        checkin_id,
        organization_slug: str | None = None,
        *args,
        **kwargs,
    ):
        try:
            monitor = Monitor.objects.get(guid=monitor_id)
        except Monitor.DoesNotExist:
            raise ResourceDoesNotExist

        project = Project.objects.get_from_cache(id=monitor.project_id)
        if project.status != ProjectStatus.VISIBLE:
            raise ResourceDoesNotExist

        if organization_slug:
            if project.organization.slug != organization_slug:
                return self.respond_invalid()

        if hasattr(request.auth, "project_id") and project.id != request.auth.project_id:
            return self.respond(status=400)

        self.check_object_permissions(request, project)

        with configure_scope() as scope:
            scope.set_tag("project", project.id)

        bind_organization_context(project.organization)

        # we support the magic keyword of "latest" to grab the most recent check-in
        # which is unfinished (thus still mutable)
        if checkin_id == "latest":
            checkin = (
                MonitorCheckIn.objects.filter(monitor=monitor)
                .exclude(status__in=CheckInStatus.FINISHED_VALUES)
                .order_by("-date_added")
                .first()
            )
            if not checkin:
                raise ResourceDoesNotExist
        else:
            try:
                checkin = MonitorCheckIn.objects.get(monitor=monitor, guid=checkin_id)
            except MonitorCheckIn.DoesNotExist:
                raise ResourceDoesNotExist

        request._request.organization = project.organization

        kwargs.update({"checkin": checkin, "monitor": monitor, "project": project})
        return (args, kwargs)

    @extend_schema(
        operation_id="Retrieve a check-in",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
            MONITOR_PARAMS.CHECKIN_ID,
        ],
        request=None,
        responses={
            201: inline_sentry_response_serializer(
                "MonitorCheckIn", MonitorCheckInSerializerResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def get(self, request: Request, project, monitor, checkin) -> Response:
        """
        Retrieves details for a check-in.

        You may use `latest` for the `checkin_id` parameter in order to retrieve
        the most recent (by creation date) check-in which is still mutable (not marked as finished).
        """
        # we don't allow read permission with DSNs
        if isinstance(request.auth, ProjectKey):
            return self.respond(status=401)

        return self.respond(serialize(checkin, request.user))

    @extend_schema(
        operation_id="Update a check-in",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
            MONITOR_PARAMS.CHECKIN_ID,
        ],
        request=MonitorCheckInValidator,
        responses={
            200: inline_sentry_response_serializer(
                "MonitorCheckIn", MonitorCheckInSerializerResponse
            ),
            208: RESPONSE_ALREADY_REPORTED,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def put(self, request: Request, project, monitor, checkin) -> Response:
        """
        Updates a check-in.

        Once a check-in is finished (indicated via an `ok` or `error` status) it can no longer be changed.

        If you simply wish to update that the task is still running, you can simply send an empty payload.

        You may use `latest` for the `checkin_id` parameter in order to retrieve
        the most recent (by creation date) check-in which is still mutable (not marked as finished).
        """
        if checkin.status in CheckInStatus.FINISHED_VALUES:
            return self.respond(status=400)

        serializer = MonitorCheckInValidator(
            data=request.data, partial=True, context={"project": project, "request": request}
        )
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        result = serializer.validated_data

        current_datetime = timezone.now()
        params = {"date_updated": current_datetime}
        if "status" in result:
            params["status"] = getattr(CheckInStatus, result["status"].upper())

        if "duration" in result:
            params["duration"] = result["duration"]
        # if a duration is not defined and we're at a finish state, calculate one
        elif params.get("status", checkin.status) in CheckInStatus.FINISHED_VALUES:
            duration = int((current_datetime - checkin.date_added).total_seconds() * 1000)
            params["duration"] = duration

        with transaction.atomic():
            checkin.update(**params)
            if checkin.status == CheckInStatus.ERROR:
                if not monitor.mark_failed(current_datetime):
                    return self.respond(serialize(checkin, request.user), status=208)
            else:
                monitor_params = {
                    "last_checkin": current_datetime,
                    "next_checkin": monitor.get_next_scheduled_checkin(current_datetime),
                }
                if checkin.status == CheckInStatus.OK:
                    monitor_params["status"] = MonitorStatus.OK
                Monitor.objects.filter(id=monitor.id).exclude(
                    last_checkin__gt=current_datetime
                ).update(**monitor_params)

        return self.respond(serialize(checkin, request.user))
