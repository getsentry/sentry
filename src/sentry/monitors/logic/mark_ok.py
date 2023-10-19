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

    recovery_threshold = monitor_env.monitor.config.get("recovery_threshold", 0)
    if recovery_threshold:
        previous_checkins = (
            MonitorCheckIn.objects.filter(monitor_environment=monitor_env)
            .order_by("-date_added")
            .values("id", "date_added", "status")[:recovery_threshold]
        )
        # check for successive OK previous check-ins
        if not all(
            previous_checkin["status"] == CheckInStatus.OK for previous_checkin in previous_checkins
        ):
            # don't send occurrence for active issue on an OK check-in
            return

    next_checkin = monitor_env.monitor.get_next_expected_checkin(ts)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(ts)

    params = {
        "last_checkin": checkin.date_added,
        "next_checkin": next_checkin,
        "next_checkin_latest": next_checkin_latest,
    }
    if checkin.status == CheckInStatus.OK:
        if monitor_env.monitor.status != ObjectStatus.DISABLED:
            params["status"] = MonitorStatus.OK
        # in the future this will auto-resolve associated issues
        if monitor_env.status != MonitorStatus.OK:
            params["last_state_change"] = ts
            # resolve any associated incidents
            incidents = MonitorIncident.objects.filter(
                monitor_environment=monitor_env, grouphash=monitor_env.incident_grouphash
            )
            incidents.update(resolving_checkin=checkin, resolving_timestamp=checkin.date_added)

    MonitorEnvironment.objects.filter(id=monitor_env.id).exclude(last_checkin__gt=ts).update(
        **params
    )
