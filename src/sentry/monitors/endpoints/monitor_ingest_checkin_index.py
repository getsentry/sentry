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
from sentry.constants import ObjectStatus
from sentry.models import Project, ProjectKey
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorEnvironmentLimitsExceeded,
    MonitorLimitsExceeded,
)
from sentry.monitors.serializers import MonitorCheckInSerializerResponse
from sentry.monitors.utils import signal_first_checkin, signal_first_monitor_created
from sentry.monitors.validators import MonitorCheckInValidator
from sentry.ratelimits.config import RateLimitConfig
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

    allow_auto_create_monitors = True
    """
    Creating a checkin supports automatic creation of monitors
    """

    @extend_schema(
        operation_id="Create a new check-in",
        parameters=[
            GLOBAL_PARAMS.ORG_SLUG,
            MONITOR_PARAMS.MONITOR_SLUG,
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
        self,
        request: Request,
        project: Project,
        monitor_slug: str,
        monitor: Monitor | None,
        organization_slug: str | None = None,
    ) -> Response:
        """
        Creates a new check-in for a monitor.

        If `status` is not present, it will be assumed that the check-in is starting, and be marked as `in_progress`.

        To achieve a ping-like behavior, you can simply define `status` and optionally `duration` and
        this check-in will be automatically marked as finished.

        Note: If a DSN is utilized for authentication, the response will be limited in details.
        """
        if monitor and monitor.status in [
            ObjectStatus.PENDING_DELETION,
            ObjectStatus.DELETION_IN_PROGRESS,
        ]:
            return self.respond(status=404)

        checkin_validator = MonitorCheckInValidator(
            data=request.data,
            context={
                "project": project,
                "request": request,
                "monitor_slug": monitor_slug,
                "monitor": monitor,
            },
        )
        if not checkin_validator.is_valid():
            return self.respond(checkin_validator.errors, status=400)

        result = checkin_validator.validated_data

        # MonitorEnvironment.ensure_environment handles empty environments, but
        # we don't wan to call that before the rate limit, for the rate limit
        # key we don't care as much about a user not sending an environment, so
        # let's be explicit about it not being production
        env_rate_limit_key = result.get("environment", "-")

        if not monitor:
            ratelimit_key = f"{monitor_slug}:{env_rate_limit_key}"
        else:
            ratelimit_key = f"{monitor.id}:{env_rate_limit_key}"

        if ratelimits.is_limited(
            f"monitor-checkins:{ratelimit_key}",
            limit=CHECKIN_QUOTA_LIMIT,
            window=CHECKIN_QUOTA_WINDOW,
        ):
            metrics.incr(
                "monitors.checkin.dropped.ratelimited",
                tags={"source": "api"},
            )
            raise Throttled(
                detail="Rate limited, please send no more than 5 checkins per minute per monitor"
            )

        with transaction.atomic():
            monitor_data = result.get("monitor")
            create_monitor = monitor_data and not monitor
            update_monitor = monitor_data and monitor

            # Create a new monitor during checkin. Uses update_or_create to
            # protect against races.
            try:
                if create_monitor:
                    monitor, created = Monitor.objects.update_or_create(
                        organization_id=project.organization_id,
                        slug=monitor_data["slug"],
                        defaults={
                            "project_id": project.id,
                            "name": monitor_data["name"],
                            "status": monitor_data["status"],
                            "type": monitor_data["type"],
                            "config": monitor_data["config"],
                        },
                    )

                    if created:
                        signal_first_monitor_created(project, request.user, True)
            except MonitorLimitsExceeded as e:
                return self.respond({type(e).__name__: str(e)}, status=403)

            # Monitor does not exist and we have not created one
            if not monitor:
                return self.respond(status=404)

            # Update monitor configuration during checkin if config is changed
            if update_monitor and monitor_data["config"] != monitor.config:
                monitor.update_config(
                    request.data.get("monitor_config", {}), monitor_data["config"]
                )

            try:
                monitor_environment = MonitorEnvironment.objects.ensure_environment(
                    project, monitor, result.get("environment")
                )
            except MonitorEnvironmentLimitsExceeded as e:
                return self.respond({type(e).__name__: str(e)}, status=403)

            expected_time = None
            if monitor_environment.last_checkin:
                expected_time = monitor.get_next_scheduled_checkin_without_margin(
                    monitor_environment.last_checkin
                )

            checkin = MonitorCheckIn.objects.create(
                project_id=project.id,
                monitor_id=monitor.id,
                monitor_environment=monitor_environment,
                duration=result.get("duration"),
                status=getattr(CheckInStatus, result["status"].upper()),
                expected_time=expected_time,
                monitor_config=monitor.get_validated_config(),
            )

            signal_first_checkin(project, monitor)

            if checkin.status == CheckInStatus.ERROR and monitor.status != ObjectStatus.DISABLED:
                monitor_failed = monitor_environment.mark_failed(last_checkin=checkin.date_added)
                if not monitor_failed:
                    if isinstance(request.auth, ProjectKey):
                        return self.respond(status=200)
                    return self.respond(serialize(checkin, request.user), status=200)
            else:
                monitor_environment.mark_ok(checkin, checkin.date_added)

        if isinstance(request.auth, ProjectKey):
            return self.respond({"id": str(checkin.guid)}, status=201)

        response = self.respond(serialize(checkin, request.user), status=201)
        # TODO(dcramer): this should return a single aboslute uri, aka ALWAYS including org domains if enabled
        # TODO(dcramer): both of these are patterns that we should make easier to accomplish in other endpoints
        response["Link"] = self.build_link_header(request, "checkins/latest/", rel="latest")
        response["Location"] = request.build_absolute_uri(f"checkins/{checkin.guid}/")
        return response
