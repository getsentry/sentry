from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import BaseEndpointMixin
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.monitors.models import MonitorEnvironment, MonitorStatus


class MonitorEnvironmentDetailsMixin(BaseEndpointMixin):
    def update_monitor_environment(
        self, request: Request, project, monitor, monitor_environment
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
            organization=project.organization,
            target_object=monitor_environment.id,
            event=audit_log.get_event_id("MONITOR_ENVIRONMENT_EDIT"),
            data=monitor_environment.get_audit_log_data(),
        )

        return self.respond(serialize(monitor, request.user))

    def delete_monitor_environment(
        self, request: Request, project, monitor, monitor_environment
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
