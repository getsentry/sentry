from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import NotRequired, TypedDict

from django.utils import timezone

from sentry import analytics
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorEnvironment, MonitorStatus
from sentry.monitors.tasks.detect_broken_monitor_envs import NUM_DAYS_BROKEN_PERIOD

logger = logging.getLogger(__name__)


class _Params(TypedDict):
    last_checkin: datetime
    next_checkin: datetime
    next_checkin_latest: datetime
    status: NotRequired[int]


def mark_ok(checkin: MonitorCheckIn, succeeded_at: datetime) -> None:
    """
    Given a successful check-in, attempt to resolve the active incident and
    mark the monitor as OK.

    The provided `succeeded_at` is the reference time for when the next check-in
    time is calculated from. This typically would be when the successful
    check-in was received.
    """
    monitor_env = checkin.monitor_environment

    if monitor_env is None:
        return None

    next_checkin = monitor_env.monitor.get_next_expected_checkin(succeeded_at)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(succeeded_at)

    params: _Params = {
        "last_checkin": checkin.date_added,
        "next_checkin": next_checkin,
        "next_checkin_latest": next_checkin_latest,
    }

    if monitor_env.status != MonitorStatus.OK and checkin.status == CheckInStatus.OK:
        recovery_threshold = monitor_env.monitor.config.get("recovery_threshold", 1)
        if not recovery_threshold:
            recovery_threshold = 1

        # Run incident logic if recovery threshold is set
        if recovery_threshold > 1:
            # Check if our incident is recovering
            previous_checkins = (
                MonitorCheckIn.objects.filter(monitor_environment=monitor_env)
                .values("id", "date_added", "status")
                .order_by("-date_added")[:recovery_threshold]
            )

            # Incident recovers when we have successive threshold check-ins
            incident_recovering = all(
                previous_checkin["status"] == CheckInStatus.OK
                for previous_checkin in previous_checkins
            )
        else:
            # Mark any open incidents as recovering by default
            incident_recovering = True

        # Resolve any open incidents
        if incident_recovering:
            params["status"] = MonitorStatus.OK
            incident = monitor_env.active_incident
            if incident:
                resolve_incident_group(incident.grouphash, checkin.monitor.project_id)
                incident.update(
                    resolving_checkin=checkin,
                    resolving_timestamp=checkin.date_added,
                )
                logger.info(
                    "monitors.logic.mark_ok.resolving_incident",
                    extra={
                        "monitor_env_id": monitor_env.id,
                        "incident_id": incident.id,
                        "grouphash": incident.grouphash,
                    },
                )
                # if incident was longer than the broken env time, check if there was a broken detection that is also now resolved
                if (
                    incident.starting_timestamp is not None
                    and incident.starting_timestamp
                    <= timezone.now() - timedelta(days=NUM_DAYS_BROKEN_PERIOD)
                ):
                    if incident.monitorenvbrokendetection_set.exists():
                        analytics.record(
                            "cron_monitor_broken_status.recovery",
                            organization_id=monitor_env.monitor.organization_id,
                            project_id=monitor_env.monitor.project_id,
                            monitor_id=monitor_env.monitor.id,
                            monitor_env_id=monitor_env.id,
                        )

    MonitorEnvironment.objects.filter(id=monitor_env.id).exclude(
        last_checkin__gt=succeeded_at
    ).update(**params)


def resolve_incident_group(
    fingerprint: str,
    project_id: int,
):
    from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
    from sentry.issues.status_change_message import StatusChangeMessage
    from sentry.models.group import GroupStatus

    status_change = StatusChangeMessage(
        fingerprint=[fingerprint],
        project_id=project_id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
    )

    produce_occurrence_to_kafka(
        payload_type=PayloadType.STATUS_CHANGE,
        status_change=status_change,
    )
