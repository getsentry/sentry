from __future__ import annotations

from typing import List

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.authentication import DSNAuthentication
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.monitor import MonitorEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.monitorcheckin import MonitorCheckInSerializerResponse
from sentry.api.validators import MonitorCheckInValidator
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS, MONITOR_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, Project, ProjectKey
from sentry.signals import first_cron_checkin_received, first_cron_monitor_created


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class MonitorCheckInsEndpoint(MonitorEndpoint):
    authentication_classes = MonitorEndpoint.authentication_classes + (DSNAuthentication,)
    public = {"GET", "POST"}

    @extend_schema(
        operation_id="Retrieve check-ins for a monitor",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
            MONITOR_PARAMS.CHECKIN_ID,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "CheckInList", List[MonitorCheckInSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def get(
        self, request: Request, project, monitor, organization_slug: str | None = None
    ) -> Response:
        """
        Retrieve a list of check-ins for a monitor
        """
        # we don't allow read permission with DSNs
        if isinstance(request.auth, ProjectKey):
            return self.respond(status=401)

        if organization_slug:
            if project.organization.slug != organization_slug:
                return self.respond_invalid()

        queryset = MonitorCheckIn.objects.filter(monitor_id=monitor.id)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        operation_id="Create a new check-in",
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
            201: inline_sentry_response_serializer(
                "MonitorCheckIn", MonitorCheckInSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def post(
        self, request: Request, project, monitor, organization_slug: str | None = None
    ) -> Response:
        """
        Creates a new check-in for a monitor.

        If `status` is not present, it will be assumed that the check-in is starting, and be marked as `in_progress`.

        To achieve a ping-like behavior, you can simply define `status` and optionally `duration` and
        this check-in will be automatically marked as finished.

        Note: If a DSN is utilized for authentication, the response will be limited in details.
        """
        if organization_slug:
            if project.organization.slug != organization_slug:
                return self.respond_invalid()

        if monitor.status in [MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS]:
            return self.respond(status=404)

        serializer = MonitorCheckInValidator(
            data=request.data, context={"project": project, "request": request}
        )
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        result = serializer.validated_data

        with transaction.atomic():
            checkin = MonitorCheckIn.objects.create(
                project_id=project.id,
                monitor_id=monitor.id,
                duration=result.get("duration"),
                status=getattr(CheckInStatus, result["status"].upper()),
            )

            if not project.flags.has_cron_checkins:
                # Backfill users that already have cron monitors
                if not project.flags.has_cron_monitors:
                    first_cron_monitor_created.send_robust(
                        project=project, user=None, sender=Project
                    )
                first_cron_checkin_received.send_robust(
                    project=project, monitor_id=str(monitor.guid), sender=Project
                )

            if checkin.status == CheckInStatus.ERROR and monitor.status != MonitorStatus.DISABLED:
                if not monitor.mark_failed(last_checkin=checkin.date_added):
                    if isinstance(request.auth, ProjectKey):
                        return self.respond(status=200)
                    return self.respond(serialize(checkin, request.user), status=200)
            else:
                monitor_params = {
                    "last_checkin": checkin.date_added,
                    "next_checkin": monitor.get_next_scheduled_checkin(checkin.date_added),
                }
                if checkin.status == CheckInStatus.OK and monitor.status != MonitorStatus.DISABLED:
                    monitor_params["status"] = MonitorStatus.OK
                Monitor.objects.filter(id=monitor.id).exclude(
                    last_checkin__gt=checkin.date_added
                ).update(**monitor_params)

        if isinstance(request.auth, ProjectKey):
            return self.respond({"id": str(checkin.guid)}, status=201)

        response = self.respond(serialize(checkin, request.user), status=201)
        # TODO(dcramer): this should return a single aboslute uri, aka ALWAYS including org domains if enabled
        # TODO(dcramer): both of these are patterns that we should make easier to accomplish in other endpoints
        response["Link"] = self.build_link_header(request, "checkins/latest/", rel="latest")
        response["Location"] = request.build_absolute_uri(f"checkins/{checkin.guid}/")
        return response
