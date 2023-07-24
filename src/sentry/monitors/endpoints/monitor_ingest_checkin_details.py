from __future__ import annotations

from django.db import router, transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_ALREADY_REPORTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import Project
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorEnvironment
from sentry.monitors.serializers import MonitorCheckInSerializerResponse
from sentry.monitors.utils import get_new_timeout_at, valid_duration
from sentry.monitors.validators import MonitorCheckInValidator

from .base import MonitorIngestEndpoint


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class MonitorIngestCheckInDetailsEndpoint(MonitorIngestEndpoint):
    public = {"PUT"}

    @extend_schema(
        operation_id="Update a check-in",
        parameters=[
            GlobalParams.ORG_SLUG,
            MonitorParams.MONITOR_SLUG,
            MonitorParams.CHECKIN_ID,
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
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self,
        request: Request,
        project: Project,
        monitor: Monitor,
        checkin: MonitorCheckIn,
    ) -> Response:
        """
        Updates a check-in.

        Once a check-in is finished (indicated via an `ok` or `error` status) it can no longer be changed.

        If you simply wish to update that the task is still running, you can simply send an empty payload.

        You may use `latest` for the `checkin_id` parameter in order to retrieve
        the most recent (by creation date) check-in which is still mutable (not marked as finished).
        """
        if checkin.status in CheckInStatus.FINISHED_VALUES:
            return self.respond(status=400)

        # Discard monitor config as it is not used
        request_data = request.data.copy()
        request_data.pop("monitor_config", None)

        serializer = MonitorCheckInValidator(
            data=request_data,
            partial=True,
            context={
                "project": project,
                "request": request,
            },
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
        # if a duration is not defined and we're at a finished state, calculate one
        elif params.get("status", checkin.status) in CheckInStatus.FINISHED_VALUES:
            duration = int((current_datetime - checkin.date_added).total_seconds() * 1000)
            if not valid_duration(duration):
                return self.respond({"duration": ["Check-in has is too old to update"]}, status=400)

            params["duration"] = duration

        params["timeout_at"] = get_new_timeout_at(
            checkin, params.get("status", checkin.status), params["date_updated"]
        )

        # TODO(rjo100): will need to remove this when environment is ensured
        monitor_environment = checkin.monitor_environment
        if not monitor_environment:
            monitor_environment = MonitorEnvironment.objects.ensure_environment(
                project, monitor, result.get("environment")
            )
            checkin.monitor_environment = monitor_environment
            checkin.save()

        with transaction.atomic(router.db_for_write(MonitorEnvironment)):
            checkin.update(**params)

            if checkin.status == CheckInStatus.ERROR:
                monitor_failed = monitor_environment.mark_failed(current_datetime)
                if not monitor_failed:
                    return self.respond(serialize(checkin, request.user), status=208)
            else:
                monitor_environment.mark_ok(checkin, current_datetime)

        return self.respond(serialize(checkin, request.user))
