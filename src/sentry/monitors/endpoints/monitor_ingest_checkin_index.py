from __future__ import annotations

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import Throttled
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import ratelimits
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOTFOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GLOBAL_PARAMS, MONITOR_PARAMS
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models import Environment, Project, ProjectKey
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
)
from sentry.monitors.serializers import MonitorCheckInSerializerResponse
from sentry.monitors.validators import MonitorCheckInValidator
from sentry.ratelimits.config import RateLimitConfig
from sentry.signals import first_cron_checkin_received, first_cron_monitor_created
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics

from .base import MonitorIngestEndpoint

CHECKIN_QUOTA_LIMIT = 5
CHECKIN_QUOTA_WINDOW = 60


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class MonitorIngestCheckInIndexEndpoint(MonitorIngestEndpoint):
    public = {"POST"}

    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(40 * 60, 60),
                RateLimitCategory.USER: RateLimit(40 * 60, 60),
                RateLimitCategory.ORGANIZATION: RateLimit(40 * 60, 60),
            }
        },
    )

    @extend_schema(
        operation_id="Create a new check-in",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_ID,
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
        if monitor.status in [MonitorStatus.PENDING_DELETION, MonitorStatus.DELETION_IN_PROGRESS]:
            return self.respond(status=404)

        serializer = MonitorCheckInValidator(
            data=request.data, context={"project": project, "request": request}
        )
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        if ratelimits.is_limited(
            f"monitor-checkins:{monitor.id}",
            limit=CHECKIN_QUOTA_LIMIT,
            window=CHECKIN_QUOTA_WINDOW,
        ):
            metrics.incr("monitors.checkin.dropped.ratelimited")
            raise Throttled(
                detail="Rate limited, please send no more than 5 checkins per minute per monitor"
            )

        result = serializer.validated_data

        with transaction.atomic():
            environment_name = result.get("environment")
            if not environment_name:
                environment_name = "production"

            environment = Environment.get_or_create(project=project, name=environment_name)

            monitorenvironment_defaults = {
                "status": monitor.status,
                "next_checkin": monitor.next_checkin,
                "last_checkin": monitor.last_checkin,
            }
            monitor_environment = MonitorEnvironment.objects.get_or_create(
                monitor=monitor, environment=environment, defaults=monitorenvironment_defaults
            )[0]

            checkin = MonitorCheckIn.objects.create(
                project_id=project.id,
                monitor_id=monitor.id,
                monitor_environment=monitor_environment,
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
                monitor_failed = monitor.mark_failed(last_checkin=checkin.date_added)
                monitor_environment.mark_failed(last_checkin=checkin.date_added)
                if not monitor_failed:
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
                MonitorEnvironment.objects.filter(id=monitor_environment.id).exclude(
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
