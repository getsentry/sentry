from datetime import datetime

from sentry.constants import ObjectStatus
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
)


def mark_ok(checkin: MonitorCheckIn, ts: datetime):
    monitor_env = checkin.monitor_environment

    next_checkin = monitor_env.monitor.get_next_expected_checkin(ts)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(ts)

    params = {
        "last_checkin": checkin.date_added,
        "next_checkin": next_checkin,
        "next_checkin_latest": next_checkin_latest,
    }

    # If the monitor is already in OK status there's not incident update or
    # status change necessary
    if monitor_env.status == CheckInStatus.OK:
        MonitorEnvironment.objects.filter(id=monitor_env.id).exclude(last_checkin__gt=ts).update(
            **params
        )
        return

    recovery_threshold = monitor_env.monitor.config.get("recovery_threshold", 0)
    using_incidents = bool(recovery_threshold)

    # If we're not using incidents we can just immediately update the status
    if not using_incidents and monitor_env.monitor.status != ObjectStatus.DISABLED:
        MonitorEnvironment.objects.filter(id=monitor_env.id).exclude(last_checkin__gt=ts).update(
            status=MonitorStatus.OK,
            **params,
        )
        return

    # Check if our incident is recovering
    previous_checkins = MonitorCheckIn.objects.filter(monitor_environment=monitor_env).order_by(
        "-date_added"
    )[:recovery_threshold]

    # Incident recovers when we have successive threshold check-ins
    incident_recovering = all(
        previous_checkin.status == CheckInStatus.OK for previous_checkin in previous_checkins
    )

    # Resolve the incident
    if incident_recovering and monitor_env.status != MonitorStatus.OK:
        MonitorIncident.objects.filter(
            monitor_environment=monitor_env,
            grouphash=monitor_env.incident_grouphash,
        ).update(
            resolving_checkin=checkin,
            resolving_timestamp=checkin.date_added,
        )

        if monitor_env.monitor.status != ObjectStatus.DISABLED:
            params["last_state_change"] = ts
            params["status"] = MonitorStatus.OK

    MonitorEnvironment.objects.filter(id=monitor_env.id).exclude(last_checkin__gt=ts).update(
        **params
    )
